#!/bin/bash

##############################################################################
# This script is designed to clone the repo and configure and start the app. #
##############################################################################

# Requires packages: docker, docker-compose, procmail, git, sed, tac, potentially others depending on your distro

echo "Starting deployMaster.sh Script..."

###############
# Basic Setup #
###############

# Enter the folder to spin up an instance
cd temp || { echo "Instance Folder Missing, Aborting."; exit 1; }

# For maximum reproducibility, delete the old folder
rm -rf master

# Create a new folder
echo "Creating folder"
mkdir master

# Enter it
cd master || { echo "Folder Missing, Aborting."; exit 1; }

# Clone the repo
echo "Cloning repo"
git clone --depth 1 https://github.com/PollBuddy/PollBuddy || { echo "Repo Cloning Failed, Aborting."; exit 1; }

# Enter it
cd PollBuddy || { echo "Repo Folder Missing, Aborting."; exit 1; }


#############################
# Create and Start instance #
#############################

# Start the new instance
echo "Starting master"
kubectl apply -f kubernetes/ || { echo "Kubectl Apply Failed, Aborting."; exit 1; }

# Wait for the service to exist (for good measure)
sleep 5

# We're done!
echo "Master is now running"


##########
# Finish #
##########

# We're done!
echo "Deployment completed successfully!"
echo "Deploy Link: https://pollbuddy.app/"
