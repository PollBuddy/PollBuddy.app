
function auto_page_reload() {
  setTimeout(function() { window.location.reload(); }, 30000);
}
auto_page_reload();

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
            document.getElementById(dev_instance_type + "-" + dev_instance_id).innerText = "Success! Reloading in 15s...";
            setTimeout(function() { window.location.reload(); }, 15000);
         } else {
            document.getElementById(dev_instance_type + "-" + dev_instance_id).innerText = "Unable to apply action, please try again.";
         }
      });
}
