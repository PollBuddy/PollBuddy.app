#!/bin/bash

####################################################################################################
# This script is designed to be called with a type string (either issue or pr) and a commit/pr ID. #
# It will then take that info and use the existing repo folder to delete the app instance.         #
####################################################################################################

# Requires packages: docker, docker-compose, procmail, git, sed, tac, potentially others depending on your distro

echo "Starting deleteTestInstance.sh Script..."


#######################
# Argument Validation #
#######################

# Name the variables
TYPE=$1
ID=$2
# ID Might have "pr" prefixed, delete if so
ID=${ID//pr/}
SHORTID=${ID:0:7}
ORIGINALID=${ID}

############
# Deletion #
############

# Enter the instance folder
cd "instances" || { echo "Instances folder missing, aborting."; exit 1; }

# Try to enter the instance folder. It may be already deleted if something went wrong halfway through a previous run.
if [ -d "${ID}" ]
then
  cd "${ID}/PollBuddy" || { echo "Cannot cd into instance folder, aborting!"; exit 1; }

  # Delete the instance from Kubernetes
  echo "Deleting instance"
  kubectl delete -f kubernetes/ || { echo "Kubectl delete failed, aborting!"; exit 1; }

  # Delete the instance folder
  cd ../.. || { echo "Could not cd backwards, aborting!"; exit 1; }
  rm -rf "${ID}"

else
  echo "Instance folder appears to already have been deleted, skipping."
fi

# We're done!
echo "Instance is now deleted."

######################
# Configure Dev Site #
######################

# Talk about it
echo "Configuring dev site."

# Move out of the instance folder
cd .. || { echo "Could not cd backwards, aborting!"; exit 1; }

# Include ID change fix from deployTestInstance.sh
if [ "${TYPE}" = "pr" ]; then
  ID="pr${ID}"
  SHORTID="pr${SHORTID}"
fi

# Delete the configuration file
rm -f "configurations/${ID}.conf"

# We're done!
echo "Dev site configured."

####################
# Restart Dev Site #
####################

# Talk about it
echo "Reloading dev site configs"

# Find the process ID of the oldest httpd process and send it the USR1 signal for a graceful restart
pgrep -o httpd | xargs kill -s USR1 || { echo "Dev site config reload failed, aborting!"; exit 1; }

# We're done!
echo "Dev site reloaded."


##########
# Finish #
##########

# We're done!
echo "Instance deletion completed successfully!"
