#!/bin/bash

####################################################################################################
# This script is designed to be called with a commit/pr ID and a type string (either issue or pr). #
# It will then take that, clone the repo, check out the commit or PR, and configure and start      #
# the app based on that.                                                                           #
####################################################################################################

echo "Starting deployTestInstance.sh Script..."


#######################
# Argument Validation #
#######################

# Name the variables
TYPE=$1
ID=$2
SHORTID=${ID:0:7}
ORIGINALID=${ID}

###############
# Basic Setup #
###############

# Echo out what we're doing
echo "Creating instance for '${TYPE}' with ID '${ID}'"

# Enter the folder to spin up an instance
cd temp || { echo "Test Instances Folder Missing, Aborting."; exit 1; }

# If for some reason this job was being rerun, we'll want to delete the old folder. We don't care if it fails of course
rm -rf "${ID}"

# Create a folder for this instance
echo "Creating folder for this instance"
mkdir "${ID}"

# Enter it
cd "${ID}" || { echo "Commit Folder Missing, Aborting."; exit 1; }

# Clone the repo
echo "Cloning repo"
git clone https://github.com/PollBuddy/PollBuddy || { echo "Repo Cloning Failed, Aborting."; exit 1; }

# Enter it
cd PollBuddy || { echo "Repo Folder Missing, Aborting."; exit 1; }

# Checkout depending on mode
if [ "${TYPE}" = "commit" ]; then

  # Checkout the commit
  echo "Checking out commit"
  git checkout "${ID}" || { echo "Commit Checkout Failed, Aborting."; exit 1; }

elif [ "${TYPE}" = "pr" ]; then

  # Checkout the PR
  echo "Checking out PR"

  # Configure remotes to allow checking out PR merge commits
  # See: https://gist.github.com/piscisaureus/3342247

  # Add remote URL
  sed -i '/fetch = +refs\/heads\/\*:refs\/remotes\/origin\/\*/a \\tfetch = +refs\/pull\/*\/head:refs\/remotes\/origin\/pr\/*' .git/config || { echo "PR Checkout Failed at SED, Aborting."; exit 1; }

  # Pull PR
  git fetch origin "refs/pull/${ID}/head:pr/${ID}" || { echo "PR Checkout Failed at FETCH, Aborting."; exit 1; }

  # Checkout PR
  git checkout "pr/${ID}" || { echo "PR Checkout Failed and CHECKOUT, Aborting."; exit 1; }

else
  echo "Invalid type."
  exit 1
fi


############################
# Configure Instance Setup #
############################

# Echo out what we're doing
echo "Configuring Kubernetes files"

# Kubernetes gets very mad if a label is a number and not a string, so we need to prefix PRs
if [ "${TYPE}" = "pr" ]; then
  ID="pr${ID}"
  SHORTID="pr${SHORTID}"
fi

# Change variables in the YAML files
for f in kubernetes/*.yml
do
  echo "Processing $f file..."
  sed -i "s/production/development/g" "$f" || { echo "SED Failed, Aborting."; exit 1; }
  sed -i "s/master/${SHORTID}/g" "$f" || { echo "SED Failed, Aborting."; exit 1; }
  sed -i "s/no-type/${TYPE}/g" "$f" || { echo "SED Failed, Aborting."; exit 1; }
  sed -i "s/no-id/${ID}/g" "$f" || { echo "SED Failed, Aborting."; exit 1; }
  sed -i "s/latest/${ORIGINALID}/g" "$f" || { echo "SED Failed, Aborting."; exit 1; }
done

# We're done configuring
echo "Configuring complete"


#############################
# Create and Start instance #
#############################

# Start the new instance
echo "Starting instance"
kubectl apply -f kubernetes/ || { echo "Kubectl Apply Failed, Aborting."; exit 1; }

# Wait for the service to exist (for good measure)
sleep 5

# Scale the DB replicas to 1 instead of the default 3, since apparently Kubernetes has rather low pod limits per node,
# and it's not unlikely we'll hit those limits with 3 DBs per instance. Also, they're just test instances, they don't
# actually need 3 DBs.
kubectl scale statefulset "poll-buddy-db-statefulset-${ID}" --replicas 1

# We're done!
echo "Instance is now running"


######################
# Configure Dev Site #
######################

# Talk about it
echo "Configuring dev site"

# Move out of the instance folder
cd ../../../

# Copy example configuration file
cp NGINX_TEMPLATE.conf "conf.d.dev/${ID}.conf" || { echo "Template NGINX Config Copy Failed, Aborting."; exit 1; }

# Get the service port and name
SVCNAME=poll-buddy-frontend-service-${SHORTID}
SVCPORT=$(kubectl get svc --selector=app.kubernetes.io/name="${SVCNAME}" -o go-template='{{range .items}}{{range.spec.ports}}{{if .nodePort}}{{.nodePort}}{{"\n"}}{{end}}{{end}}{{end}}')

# Edit configuration file
sed -i "s/TEMPLATE_ID/${ORIGINALID}/g" "conf.d.dev/${ID}.conf" || { echo "NGINX SED Failed, Aborting."; exit 1; }
sed -i "s/TEMPLATE_SERVICE_NAME/${SVCNAME}/g" "conf.d.dev/${ID}.conf" || { echo "NGINX SED Failed, Aborting."; exit 1; }
sed -i "s/TEMPLATE_SERVICE_PORT/${SVCPORT}/g" "conf.d.dev/${ID}.conf" || { echo "NGINX SED Failed, Aborting."; exit 1; }

# We're done!
echo "Dev site configured"

####################
# Restart Dev Site #
####################

# Talk about it
echo "Reloading dev site configs"
ps -ef | grep "nginx: master process" | grep -v grep | awk '{print $2}' | xargs kill -s HUP || { echo "NGINX Reload Failed, Aborting."; exit 1; }

# We're done!
echo "Dev site reloaded"


##########
# Finish #
##########

# We're done!
echo "Deployment completed successfully!"
echo "Deploy Link: https://dev-${ID}.pollbuddy.app/"
