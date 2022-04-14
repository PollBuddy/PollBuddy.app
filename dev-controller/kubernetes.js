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

    k8sApi.listNamespacedService('default', "true", false, undefined, undefined, "app=poll-buddy,dev-instance-type=pull-request,dev-instance-id=650").then(async (res) => {
      //console.log(res.body);
      let items = res.body.items;
      for (let i = 0; i < items.length; i++) {
        // Add pod info
        //console.log("ITEMS");
        //console.log(items[i]);
        await k8sApi.listNamespacedPod('default', "true", false,
          undefined, undefined,
          `app=poll-buddy,dev-instance-type=${items[i]["metadata"]["labels"]["dev-instance-type"]},dev-instance-id=${items[i]["metadata"]["labels"]["dev-instance-id"]}`)
          .then((res) => {
            //console.log(res.body);
            items[i]["pods"] = res.body.items;
          });

      }
      callback(res.body.items);
    });
  },

  startService: function(dev_instance_type, dev_instance_id, callback) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(k8s.AppsV1Api);

    k8sApi.patchNamespacedDeploymentScale('poll-buddy-deployment').then((res) => {
      //console.log(res.body);
      callback(res.body);
    });

    return callback(true);
  },

  stopService: function(dev_instance_type, dev_instance_id, callback) {
    return callback(true);
  },

  deleteService: function(dev_instance_type, dev_instance_id, callback) {
    return callback(true);
  },
}


