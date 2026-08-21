#!/usr/bin/env bash
# Bootstrap a single-node k3s host for the local Converged deployment.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "$ROOT_DIR/.." && pwd)"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-/etc/rancher/k3s/k3s.yaml}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.17.2}"
GATEWAY_API_VERSION="${GATEWAY_API_VERSION:-v1.2.1}"
DOMAIN_BASE="${DOMAIN_BASE:-4ir.local}"
TLS_SECRET_NAME="${TLS_SECRET_NAME:-converged-local-tls}"
LOCAL_ISSUER_NAME="${LOCAL_ISSUER_NAME:-converged-local-selfsigned}"
TRAEFIK_HTTPS_ENTRYPOINT_PORT="${TRAEFIK_HTTPS_ENTRYPOINT_PORT:-8443}"
PTAH_RELEASE="${PTAH_RELEASE:-converged-ptah}"
PTAH_NAMESPACE="${PTAH_NAMESPACE:-converged}"
PTAH_IMAGE_REPOSITORY="${PTAH_IMAGE_REPOSITORY:-public.ecr.aws/i5x9u8b2/ptah}"
PTAH_IMAGE_TAG="${PTAH_IMAGE_TAG:-latest}"
IAC_DIR="${IAC_DIR:-$WORKSPACE_DIR/4ir/START/IAC}"

if [[ "${EUID}" -ne 0 ]]; then
	printf '%s\n' "Run this installer as root: sudo $0" >&2
	exit 1
fi

export KUBECONFIG="$KUBECONFIG_PATH"

wait_for() {
	local description="$1"
	shift
	local attempts=0
	until "$@"; do
		attempts=$((attempts + 1))
		if (( attempts >= 120 )); then
			printf 'Timed out waiting for %s\n' "$description" >&2
			return 1
		fi
		sleep 2
	done
}

apply_traefik_gateway_config() {
	kubectl apply -f - <<'YAML'
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    providers:
      kubernetesGateway:
        enabled: true
        nativeLBByDefault: true
YAML
}

install_k3s() {
	if ! systemctl is-active --quiet k3s; then
		curl -sfL https://get.k3s.io | sh -
	fi
	wait_for "k3s API" kubectl get --raw=/readyz
	wait_for "a Ready node" sh -c 'kubectl get nodes --no-headers 2>/dev/null | awk '\''$2 == "Ready" { found=1 } END { exit !found }'\'''
}

install_helm() {
	if ! command -v helm >/dev/null 2>&1; then
		curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
	fi
}

install_gateway_api() {
	kubectl apply -f "https://github.com/kubernetes-sigs/gateway-api/releases/download/${GATEWAY_API_VERSION}/standard-install.yaml"
	apply_traefik_gateway_config
	wait_for "Traefik deployment" kubectl -n kube-system get deployment/traefik
	kubectl -n kube-system rollout status deployment/traefik --timeout=5m
	wait_for "Traefik GatewayClass" kubectl get gatewayclass/traefik
}

install_cert_manager() {
	kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.crds.yaml"
	kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"
	kubectl -n cert-manager rollout status deployment/cert-manager --timeout=5m
	kubectl -n cert-manager rollout status deployment/cert-manager-webhook --timeout=5m
	kubectl -n cert-manager rollout status deployment/cert-manager-cainjector --timeout=5m
}

install_local_issuer() {
	kubectl apply -f - <<YAML
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: ${LOCAL_ISSUER_NAME}
spec:
  selfSigned: {}
YAML
}

install_club_landing() {
	kubectl apply -f - <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: club-landing
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: club-landing
  template:
    metadata:
      labels:
        app.kubernetes.io/name: club-landing
    spec:
      containers:
        - name: landing
          image: public.ecr.aws/i5x9u8b2/club-landing:latest
          ports:
            - containerPort: 8080
              name: http
          readinessProbe:
            tcpSocket:
              port: http
            initialDelaySeconds: 2
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: club-landing
  namespace: default
spec:
  selector:
    app.kubernetes.io/name: club-landing
  ports:
    - name: http
      port: 8080
      targetPort: http
YAML
	kubectl -n default rollout status deployment/club-landing --timeout=5m
}

apply_generated_certificates() {
	if [[ ! -d "$IAC_DIR" ]]; then
		printf 'IAC directory not found: %s\n' "$IAC_DIR" >&2
		return 1
	fi
	if ! command -v bun >/dev/null 2>&1; then
		printf '%s\n' "bun is required to run the certificate generator" >&2
		return 1
	fi

	local generator="$IAC_DIR/src/certs.ts"
	if [[ ! -f "$generator" ]]; then
		generator="$IAC_DIR/src/serts.ts"
	fi
	if [[ ! -f "$generator" ]]; then
		printf 'Certificate generator not found under %s/src\n' "$IAC_DIR" >&2
		return 1
	fi

	(
		cd "$IAC_DIR"
		[[ -d node_modules ]] || bun install --frozen-lockfile
		bun run "$generator"
	)

	shopt -s nullglob
	local manifests=("$IAC_DIR"/dist/k3s-infrastructure.k8s.yaml "$IAC_DIR"/dist/*-chart.k8s.yaml)
	shopt -u nullglob
	if (( ${#manifests[@]} == 0 )); then
		printf 'Certificate generator produced no manifests in %s/dist\n' "$IAC_DIR" >&2
		return 1
	fi
	for manifest in "${manifests[@]}"; do
		[[ -f "$manifest" ]] && kubectl apply -f "$manifest"
	done
}

install_ptah() {
	if [[ ! -f "$WORKSPACE_DIR/confs/converged-secrets.yaml" ]]; then
		printf 'Required platform Secret is missing: %s\n' "$WORKSPACE_DIR/confs/converged-secrets.yaml" >&2
		return 1
	fi
	kubectl create namespace "$PTAH_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -f "$WORKSPACE_DIR/confs/converged-secrets.yaml"

	helm upgrade --install "$PTAH_RELEASE" "$ROOT_DIR/core/native/apps/ptah/chart" \
		--namespace "$PTAH_NAMESPACE" \
		--create-namespace \
		--wait \
		--set-string image.repository="$PTAH_IMAGE_REPOSITORY" \
		--set-string image.tag="$PTAH_IMAGE_TAG" \
		--set-string platform.spec.domainBase="$DOMAIN_BASE" \
		--set-string 'platform.spec.gateway.hosts[0]'="*.$DOMAIN_BASE" \
		--set-string platform.spec.gateway.tls.secretName="$TLS_SECRET_NAME" \
		--set-string platform.spec.gateway.tls.issuer="$LOCAL_ISSUER_NAME" \
		--set-string platform.spec.gateway.tls.issuerKind=ClusterIssuer \
		--set platform.spec.gateway.httpsPort="$TRAEFIK_HTTPS_ENTRYPOINT_PORT" \
		--set-string 'platform.spec.gateway.tls.dnsNames[0]'="$DOMAIN_BASE" \
		--set-string 'platform.spec.gateway.tls.dnsNames[1]'="*.$DOMAIN_BASE"

	kubectl -n "$PTAH_NAMESPACE" rollout status deployment/"$PTAH_RELEASE" --timeout=5m
	wait_for "Ptah Gateway to be programmed" sh -c "kubectl get gateway -n '$PTAH_NAMESPACE' converged -o jsonpath='{.status.conditions[?(@.type==\"Programmed\")].status}' | grep -qx True"
	kubectl -n "$PTAH_NAMESPACE" wait --for=condition=Ready certificate/converged-tls --timeout=5m
}

install_k3s
install_helm
install_gateway_api
install_cert_manager
install_local_issuer
install_club_landing
apply_generated_certificates
install_ptah

printf 'Converged is installed. Gateway: https://democnc.%s/\n' "$DOMAIN_BASE"
