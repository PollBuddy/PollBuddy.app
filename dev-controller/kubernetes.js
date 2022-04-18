const k8s = require('@kubernetes/client-node');

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

  startService: async function (dev_instance_type, dev_instance_id, callback) {
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

  stopService: async function (dev_instance_type, dev_instance_id, callback) {
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

  deleteService: function(dev_instance_type, dev_instance_id, callback) {
    return callback(true);
  },

  deployDevInstance: function(dev_instance_type, dev_instance_id, callback) {
    // Create a new folder to manage the instance files in



    // Clone repo

    // Enter kubernetes folder

    // Replace "master" and add other info as necessary to converf to a dev instance

    // Apply them to kubernetes
  },
}


