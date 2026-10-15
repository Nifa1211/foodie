# Foodie Express: DevOps-Based Food Delivery App (Microservices on Kubernetes)

A food ordering app split into microservices, containerized with Docker, deployed on Kubernetes,
built by a CI pipeline, auto-scaled under load, and monitored with Prometheus and Grafana.
**Everything runs free on your own laptop.** No AWS/Azure/GCP account or credit card needed.

## Architecture
```
Browser -> frontend (nginx) -> /api/menu   -> restaurant-service (menu)
                            -> /api/orders -> order-service (2-6 pods, autoscaled)
                                                 |-> payment-service  (mock payment)
                                                 |-> delivery-service (assigns driver)
                                                 '-> redis (stores orders, shared by all order pods)
Prometheus scrapes /metrics on every service -> Grafana dashboards + alerts
GitHub Actions: test -> build Docker images -> push to GitHub Container Registry (free)
```

## 1. Install the free tools (one time)
| Tool | Why | Install |
|---|---|---|
| Docker Desktop | builds containers | https://docs.docker.com/get-docker/ |
| minikube | local Kubernetes cluster | https://minikube.sigs.k8s.io/docs/start/ |
| kubectl | talk to the cluster | https://kubernetes.io/docs/tasks/tools/ |
| Helm | installs Prometheus/Grafana | https://helm.sh/docs/intro/install/ |
| Git + GitHub account | CI pipeline | free |

Your laptop should have about 8 GB RAM free for the full setup. Docker Desktop must be running.

## 2. Quick test with Docker only (5 minutes)
```bash
docker compose up --build
```
Open http://localhost:8080, add food, and place an order. Stop with `Ctrl+C`, then `docker compose down`.

## 3. Deploy on Kubernetes
```bash
./scripts/start.sh                                   # starts minikube, builds images, deploys everything
kubectl -n foodie get pods                           # wait until all are Running
kubectl -n foodie port-forward svc/frontend 8080:80  # leave running, open http://localhost:8080
```
Windows users: run the scripts in Git Bash or WSL.

Place an order and look at the "Order handled by pod" badge. With 2 order pods it changes between pods, which shows load balancing.

## 4. Monitoring (Prometheus + Grafana)
```bash
./scripts/monitoring.sh
kubectl -n monitoring port-forward svc/monitoring-grafana 3000:80    # http://localhost:3000  (admin / prom-operator)
```
Useful Grafana queries (Explore, Prometheus data source):
- Requests per second by service: `sum(rate(http_requests_total[1m])) by (service)`
- Order pod CPU: `sum(rate(container_cpu_usage_seconds_total{namespace="foodie",pod=~"order-service.*"}[1m])) by (pod)`
- Running order pods: `count(kube_pod_info{namespace="foodie",pod=~"order-service.*"})`

Ready-made dashboard: in Grafana go to Dashboards, then "Kubernetes / Compute Resources / Namespace (Pods)" and pick namespace `foodie`.

## 5. Auto-scaling demo (the impressive part)
Terminal 1: `kubectl -n foodie get hpa order-service-hpa -w`

Terminal 2 (keep the port-forward from step 3 running):
```bash
docker run --rm -i --add-host=host.docker.internal:host-gateway grafana/k6 run \
  -e BASE_URL=http://host.docker.internal:8080 - < loadtest/load.js
```
Over 2 to 3 minutes the CPU target (50%) is exceeded and order-service scales from 2 to as many as 6 pods. When the test ends it scales back down. Take screenshots of the HPA output and the Grafana graph for your report.

## 6. Self-healing demo
```bash
kubectl -n foodie delete pod -l app=order-service --wait=false
kubectl -n foodie get pods -w     # Kubernetes recreates them; the app keeps working
```

## 7. CI/CD with GitHub Actions
1. Create a GitHub repo and push this folder to the `main` branch.
2. Every push runs `.github/workflows/ci.yml`: install, test, build Docker image, push to `ghcr.io/<your-username>/foodie-<service>`.
3. Check the **Actions** tab for the green run, and **Packages** for the images.
4. To deploy a change to your local cluster (the CD step): `git pull && ./scripts/deploy-update.sh`.

GitHub's cloud runners cannot reach a laptop cluster, so the deploy step runs locally. In your report you can say the pipeline is CI to a registry plus scripted CD, and that a self-hosted runner or ArgoCD would make it fully automatic.

## Project layout
```
services/restaurant|order|payment|delivery   Node.js + Express microservices (each has a Dockerfile)
frontend/                                    nginx + single page UI (also acts as API gateway)
k8s/app.yaml                                 Deployments, Services, probes, resource limits, HPA
k8s/monitoring/servicemonitor.yaml           Prometheus scrape config + alert rules
.github/workflows/ci.yml                     CI pipeline
scripts/                                     start.sh, monitoring.sh, deploy-update.sh
loadtest/load.js                             k6 load test
docker-compose.yml                           quick local run
```

## Troubleshooting
- **Pods stuck in `ErrImageNeverPull` or `ImagePullBackOff`:** run `./scripts/start.sh` again (it builds images inside minikube).
- **HPA shows `<unknown>` CPU:** run `minikube addons enable metrics-server`, then wait a minute.
- **minikube is slow or crashes:** `minikube start --cpus=2 --memory=3072`, and skip monitoring until the app works.
- **Order fails with 502:** `kubectl -n foodie logs deploy/order-service` to see which downstream service failed.

## Ideas to extend it (for extra marks)
Swap Redis for PostgreSQL, add Terraform to deploy the same manifests on AWS EKS, add ArgoCD for GitOps, or add a blue-green release of order-service.
