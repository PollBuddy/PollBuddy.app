


function deployment_action(dev_instance_type, dev_instance_id, action) {
   console.log(dev_instance_type);
   console.log(dev_instance_id);
   fetch('/api/deployment/' + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
         dev_instance_type: dev_instance_type,
         dev_instance_id: dev_instance_id
      })
   }).then(response => response.json())
      // handle response
      .then(data => {
         if(data.ok) {
            document.getElementById(dev_instance_type + "-" + dev_instance_id).innerText = "Success! Reloading in 10s...";
            setTimeout(function() { window.location.reload(); }, 10000);
         } else {
            document.getElementById(dev_instance_type + "-" + dev_instance_id).innerText = "Unable to apply action, please try again.";
         }
      });
}