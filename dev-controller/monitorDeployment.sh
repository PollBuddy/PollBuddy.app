#!/bin/bash

####################################################################################################
# This script is designed to be called with a commit/pr ID and a type string (either issue or pr). #
# It will then take that and wait for 630s (600 is the default progressDeadlineSeconds, +30s for   #
# good measure), then make sure the deployment has succeeded. If it has not, this script will roll #
# back the deployment.                                                                             #
####################################################################################################

echo "Starting monitorDeployment.sh Script..."


#######################
# Argument Validation #
#######################

# Name the variables
ID=$1
SHORTID=${ID:0:7}

###############
# Basic Setup #
###############

sleep 630

cd "temp/${ID}" || exit

# Check all the deployments for success
if [[ $(timeout 5 kubectl rollout status deployment poll-buddy-frontend-deployment-"$SHORTID") != *"successfully rolled out"* ]]; then
    kubectl rollout undo deployment poll-buddy-frontend-deployment-"$SHORTID"
fi
if [[ $(timeout 5 kubectl rollout status deployment poll-buddy-backend-deployment-"$SHORTID") != *"successfully rolled out"* ]]; then
    kubectl rollout undo deployment poll-buddy-backend-deployment-"$SHORTID"
fi
if [[ $(timeout 5 kubectl rollout status deployment poll-buddy-reporting-deployment-"$SHORTID") != *"successfully rolled out"* ]]; then
    kubectl rollout undo poll-buddy-reporting-deployment-"$SHORTID"
fi
if [[ $(timeout 5 kubectl rollout status deployment poll-buddy-reporting-db-deployment-"$SHORTID") != *"successfully rolled out"* ]]; then
    kubectl rollout undo poll-buddy-reporting-db-deployment-"$SHORTID"
fi
if [[ $(timeout 5 kubectl rollout status statefulset poll-buddy-db-statefulset-"$SHORTID") != *"roll out complete"* ]]; then
    kubectl rollout undo statefulset poll-buddy-db-statefulset-"$SHORTID"
fi
