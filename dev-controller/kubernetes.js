const k8s = require('@kubernetes/client-node');
const fs = require('fs');

var deployingInstances = [];

module.exports = {
  listPods: function(callback) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

    k8sApi.listNamespacedPod('default').then((res) => {
      //console.log(res.body);
      callback(res.body);
    });
  },

  listDeployments: function(callback) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(k8s.AppsV1Api);

    k8sApi.listNamespacedDeployment('default', "true", false, undefined, undefined, "app=poll-buddy").then((res) => {
      //console.log(res.body);
      callback(res.body.items);
    });
  },

  listServices: function(callback) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

    k8sApi.listNamespacedService('default', "true", false, undefined, undefined, /*"app.kubernetes.io/part-of=poll-buddy"*/).then(async (res) => {
      console.log(res.body);
      let items = res.body.items;
      for (let i = 0; i < items.length; i++) {
        // Add pod info
        //console.log("ITEMS");
        //console.log(items[i]);
        await k8sApi.listNamespacedPod('default', "true", false,
          undefined, undefined,
          `app.kubernetes.io/part-of=poll-buddy,dev-instance-type=${items[i]["metadata"]["labels"]["dev-instance-type"]},dev-instance-id=${items[i]["metadata"]["labels"]["dev-instance-id"]}`)
          .then((res) => {
            //console.log(res.body);
            items[i]["pods"] = res.body.items;
          });

      }
      callback(res.body.items);
    });
  },

  startDevInstance: async function (dev_instance_type, dev_instance_id, callback) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(k8s.AppsV1Api);

    const patch = [
      {
        "op": "replace",
        "path": "/spec/replicas",
        "value": 1
      }
    ];
    const options = {"headers": {"Content-type": k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH}};
    await k8sApi.patchNamespacedDeploymentScale('poll-buddy-deployment', 'default', patch, undefined, undefined, undefined, undefined, options)
      .then(() => {
        console.log("Patched.")
        return callback(true);
      })
      .catch((err) => {
        console.log("Error: ");
        console.log(err);
        return callback(false);
      });
  },

  stopDevInstance: async function (dev_instance_type, dev_instance_id, callback) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(k8s.AppsV1Api);

    const patch = [
      {
        "op": "replace",
        "path": "/spec/replicas",
        "value": 0
      }
    ];
    const options = {"headers": {"Content-type": k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH}};
    await k8sApi.patchNamespacedDeploymentScale('poll-buddy-deployment', 'default', patch, undefined, undefined, undefined, undefined, options)
      .then(() => {
        console.log("Patched.")
        return callback(true);
      })
      .catch((err) => {
        console.log("Error: ");
        console.log(err);
        return callback(false);
      });
  },

  deleteDevInstance: function(dev_instance_type, dev_instance_id, callback) {
    // Delete


    return callback(true);
  },


  deployDevInstance: function(dev_instance_type, dev_instance_id, callback) {
    console.log("Creating dev instance of type " + dev_instance_type + " and ID " + dev_instance_id);

    // Create a new folder to manage the instance files in
    let tempFolder = "./temp";
    if (!fs.existsSync(tempFolder)){
      fs.mkdirSync(tempFolder);
    }

    // Exclusivity lock
    if(dev_instance_id in deployingInstances) {
      setTimeout(function() {
        deployDevInstance(dev_instance_type, dev_instance_id, callback);
      }, 5000);
      return;
    } else {
      // Add it to the lock list
      deployingInstances.push(dev_instance_id);
    }

    const { exec } = require('child_process');
    exec('bash ./deployTestInstance.sh ' + dev_instance_id + " " + dev_instance_type + " " + process.env["CLUSTER_DNS_SUBDOMAIN"],
      (err, stdout, stderr) => {
      if (err) {
        //some err occurred
        console.error(err);
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
        callback(false);
      } else {
        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        // Remove it from the lock list
        deployingInstances = deployingInstances.filter(item => item !== dev_instance_id)

        callback(true);
      }
    });

  },
}


