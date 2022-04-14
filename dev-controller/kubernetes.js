const k8s = require('@kubernetes/client-node');

module.exports = {
  listPods: function(callback) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

    k8sApi.listNamespacedPod('default').then((res) => {
      console.log(res.body);
      callback(res.body);
    });
  },
}


