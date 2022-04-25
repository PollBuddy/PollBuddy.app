const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const {exec} = require("child_process");

var deployingInstances = [];

module.exports = {

  listDevInstances: function(callback) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

    k8sApi.listNamespacedService('default', "true", false, undefined, undefined, "app.kubernetes.io/part-of=poll-buddy,environment=development,app.kubernetes.io/component=frontend").then(async (res) => {
      //console.log(res.body);
      let items = res.body.items;
      for (let i = 0; i < items.length; i++) {
        // Add pod info
        //console.log("ITEMS");
        //console.log(items[i]);
        await k8sApi.listNamespacedPod('default', "true", false,
          undefined, undefined,
          `app.kubernetes.io/part-of=poll-buddy,environment=development,dev_instance_type=${items[i]["metadata"]["labels"]["dev_instance_type"]},dev_instance_id=${items[i]["metadata"]["labels"]["dev_instance_id"]}`)
          .then((res) => {
            //console.log(res.body);
            items[i]["pods"] = res.body.items;
          });
      }
      callback(items);
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

    // Get the deployment names for this instance
    let deployments = [];
    await k8sApi.listNamespacedDeployment('default', "true", false, undefined, undefined, `app.kubernetes.io/part-of=poll-buddy,environment=development,dev_instance_type=${dev_instance_type},dev_instance_id=${dev_instance_id}`).then((res) => {
      for (let i = 0; i < res.body.items.length; i++) {
        deployments.push(res.body.items[i].metadata.name);
      }
    });

    // Update each deployment to have a replica scale of 1
    for (let i = 0; i < deployments.length; i++) {
      await k8sApi.patchNamespacedDeploymentScale(deployments[i], 'default', patch, undefined, undefined, undefined, undefined, options)
        .then(() => {
          console.log("Patched " + deployments[i]);
        })
        .catch((err) => {
          console.log("Error: ");
          console.log(err);
          return callback(false);
        });
    }

    // Scale up the DB too (3 instead)
    patch[0]["value"] = 3;
    await k8sApi.patchNamespacedStatefulSetScale("poll-buddy-db-statefulset-" + dev_instance_id.substring(0, 7), 'default', patch, undefined, undefined, undefined, undefined, options)
      .then(() => {
        console.log("Patched " + "poll-buddy-db-statefulset-" + dev_instance_id);
      })
      .catch((err) => {
        console.log("Error: ");
        console.log(err);
        return callback(false);
      });

    return callback(true);
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

    // Get the deployment names for this instance
    let deployments = [];
    await k8sApi.listNamespacedDeployment('default', "true", false, undefined, undefined, `app.kubernetes.io/part-of=poll-buddy,environment=development,dev_instance_type=${dev_instance_type},dev_instance_id=${dev_instance_id}`).then((res) => {
      for (let i = 0; i < res.body.items.length; i++) {
        deployments.push(res.body.items[i].metadata.name);
      }
    });

    // Update each deployment to have a replica scale of 1
    for (let i = 0; i < deployments.length; i++) {
      await k8sApi.patchNamespacedDeploymentScale(deployments[i], 'default', patch, undefined, undefined, undefined, undefined, options)
        .then(() => {
          console.log("Patched " + deployments[i]);
        })
        .catch((err) => {
          console.log("Error: ");
          console.log(err);
          return callback(false);
        });
    }

    // Scale down the DB too
    await k8sApi.patchNamespacedStatefulSetScale("poll-buddy-db-statefulset-" + dev_instance_id.substring(0, 7), 'default', patch, undefined, undefined, undefined, undefined, options)
      .then(() => {
        console.log("Patched " + "poll-buddy-db-statefulset-" + dev_instance_id);
      })
      .catch((err) => {
        console.log("Error: ");
        console.log(err);
        return callback(false);
      });

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
        this.deployDevInstance(dev_instance_type, dev_instance_id, callback);
      }, 5000);
      return;
    } else {
      // Add it to the lock list
      deployingInstances.push(dev_instance_id);
    }

    // Create the deployment
    const { exec } = require('child_process');
    exec('bash ./deployTestInstance.sh ' + dev_instance_type + " " + dev_instance_id + " " + process.env["CLUSTER_DNS_SUBDOMAIN"],
      (err, stdout, stderr) => {
      if (err) {
        // Some err occurred, report everything that happened
        console.error(err);
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        // Remove it from the lock list
        deployingInstances = deployingInstances.filter(item => item !== dev_instance_id)

        callback(false);
      } else {
        // the entire stdout (buffered)
        console.log(`stdout: ${stdout}`);

        // Remove it from the lock list
        deployingInstances = deployingInstances.filter(item => item !== dev_instance_id)

        // Monitor the deployment to make sure it didn't have any problems after we finished up our part
        // We don't actually care what happens as the script will do the auto rollback for us
        // Mainly to monitor master, although dev instances can be rolled back too
        exec('bash ./monitorDeployment.sh ' + dev_instance_id);

        callback(true);
      }
    });

  },

  deleteDevInstance: function(dev_instance_type, dev_instance_id, callback) {
    console.log("Deleting dev instance of type " + dev_instance_type + " and ID " + dev_instance_id);

    // Create a new folder to manage the instance files in
    let tempFolder = "./temp";
    if (!fs.existsSync(tempFolder)){
      fs.mkdirSync(tempFolder);
    }

    // Exclusivity lock
    if(dev_instance_id in deployingInstances) {
      setTimeout(function() {
        this.deleteDevInstance(dev_instance_type, dev_instance_id, callback);
      }, 5000);
      return;
    } else {
      // Add it to the lock list
      deployingInstances.push(dev_instance_id);
    }

    const { exec } = require('child_process');
    exec('bash ./deleteTestInstance.sh ' + dev_instance_type + " " + dev_instance_id + " " + process.env["CLUSTER_DNS_SUBDOMAIN"],
      (err, stdout, stderr) => {
      if (err) {
        // Some err occurred, report everything that happened
        console.error(err);
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        // Remove it from the lock list
        deployingInstances = deployingInstances.filter(item => item !== dev_instance_id)

        callback(false);
      } else {
        // the entire stdout (buffered)
        console.log(`stdout: ${stdout}`);

        // Remove it from the lock list
        deployingInstances = deployingInstances.filter(item => item !== dev_instance_id)

        callback(true);
      }
    });
  },
}


