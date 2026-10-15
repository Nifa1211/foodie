#!/usr/bin/env bash
# One command: start the local cluster, build images inside it, deploy the app.
set -euo pipefail
cd "$(dirname "$0")/.."

minikube status >/dev/null 2>&1 || minikube start --cpus=4 --memory=4096
minikube addons enable metrics-server

# Images have already been built directly into minikube
echo "Using prebuilt Foodie Express images in minikube"

kubectl apply -f k8s/app.yaml
kubectl -n foodie rollout restart deployment restaurant-service order-service payment-service delivery-service frontend
kubectl -n foodie rollout status deployment/order-service --timeout=120s
kubectl -n foodie rollout status deployment/frontend --timeout=120s

echo
echo "Done. Open the app with:"
echo "  kubectl -n foodie port-forward svc/frontend 8080:80"
echo "then visit http://localhost:8080"
