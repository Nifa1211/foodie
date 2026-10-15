#!/usr/bin/env bash
# Installs Prometheus + Grafana (kube-prometheus-stack) and wires in the foodie services.
set -euo pipefail
cd "$(dirname "$0")/.."

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.resources.requests.memory=400Mi \
  --set alertmanager.enabled=false

kubectl -n monitoring rollout status deployment/monitoring-grafana --timeout=300s
kubectl apply -f k8s/monitoring/servicemonitor.yaml

echo
echo "Open Grafana:  kubectl -n monitoring port-forward svc/monitoring-grafana 3000:80"
echo "Login: admin / prom-operator   (http://localhost:3000)"
