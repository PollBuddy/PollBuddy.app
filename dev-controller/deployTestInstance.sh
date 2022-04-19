#!/bin/bash

#################################################################################################
# This script is designed to be called with a commit ID and a mode string (either ISSUE or PR). #
# It will then take that, clone the repo, check out the commit or PR, and configure and start   #
# the app based on that.                                                                        #
#################################################################################################

# Requires packages: docker, docker-compose, procmail, git, sed, tac, potentially others depending on your distro

echo "Starting deployTestInstance.sh Script..."


#######################
# Argument Validation #
#######################

# Name the variables
ID=$1
TYPE=$2
SHORTID=${ID:0:7}

###############
# Basic Setup #
###############

# Echo out what we're doing
echo "Creating instance for commit/PR '${ID}'"

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

# Change variables in the YAML files
for f in kubernetes/*.yml
do
  echo "Processing $f file..."
  sed -i "s/production/development/g" "$f" || { echo "SED Failed, Aborting."; exit 1; }
  sed -i "s/master/${SHORTID}/g" "$f" || { echo "SED Failed, Aborting."; exit 1; }
  sed -i "s/no-type/${TYPE}/g" "$f" || { echo "SED Failed, Aborting."; exit 1; }
  sed -i "s/no-id/${ID}/g" "$f" || { echo "SED Failed, Aborting."; exit 1; }
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

# Get the service port and name
SVCNAME=poll-buddy-frontend-service-${SHORTID}
SVCPORT=$(kubectl get svc --selector=app.kubernetes.io/name="${SVCNAME}" -o go-template='{{range .items}}{{range.spec.ports}}{{if .nodePort}}{{.nodePort}}{{"\n"}}{{end}}{{end}}{{end}}')

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

# Edit configuration file
sed -i "s/TEMPLATE_ID/${ID}/g" "conf.d.dev/${ID}.conf" || { echo "NGINX SED Failed, Aborting."; exit 1; }
sed -i "s/TEMPLATE_SERVICE_NAME/${SVCNAME}/g" "conf.d.dev/${ID}.conf" || { echo "NGINX SED Failed, Aborting."; exit 1; }
sed -i "s/TEMPLATE_SERVICE_PORT/${SVCPORT}/g" "conf.d.dev/${ID}.conf" || { echo "NGINX SED Failed, Aborting."; exit 1; }

# We're done!
echo "Dev site configured"

####################
# Restart Dev Site #
####################

# Talk about it
echo "Reloading dev site configs"
kill -s HUP "$(cat /var/run/nginx.pid)" || { echo "NGINX Reload Failed, Aborting."; exit 1; }

# We're done!
echo "Dev site reloaded"


##########
# Finish #
##########

# We're done!
echo "Deployment completed successfully!"
echo "Deploy Link: https://dev-${ID}.pollbuddy.app/"
