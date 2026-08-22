#!/usr/bin/env bash
# Converged installer.
#
#   curl -sfL https://converged.4ir.club | sudo sh -
#
# Self-contained on purpose: the ptah chart travels inside this file as a
# base64 tarball, so the installer is one artefact to serve and one to audit.
# Regenerate with `bun run core/tools/install/build.ts` — editing the payload
# by hand is how the chart and the script drift apart.
set -euo pipefail

CHART_B64='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'
CHART_SHA256='7833c13cca212a66f6f8bcb0aa4acaebb123a1580a77212c5ac4b3d4cdce5729'
CHART_BUILT='2026-08-22'

KUBECONFIG_PATH="${KUBECONFIG_PATH:-/etc/rancher/k3s/k3s.yaml}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.17.2}"
GATEWAY_API_VERSION="${GATEWAY_API_VERSION:-v1.2.1}"

# Everything below can be answered at the prompt or preset in the environment,
# which is what makes the same script usable from a terminal and from CI.
WORKSPACE="${WORKSPACE:-}"
PROFILE="${PROFILE:-}"
DOMAIN_BASE="${DOMAIN_BASE:-}"

PTAH_IMAGE_REPOSITORY="${PTAH_IMAGE_REPOSITORY:-public.ecr.aws/i5x9u8b2/ptah}"
PTAH_IMAGE_TAG="${PTAH_IMAGE_TAG:-latest}"
IMAGES_REGISTRY="${IMAGES_REGISTRY:-public.ecr.aws/i5x9u8b2}"
IMAGES_TAG="${IMAGES_TAG:-latest}"
STORAGE_CLASS="${STORAGE_CLASS:-local-path}"
STORAGE_SIZE="${STORAGE_SIZE:-5Gi}"
TRAEFIK_HTTPS_ENTRYPOINT_PORT="${TRAEFIK_HTTPS_ENTRYPOINT_PORT:-8443}"
LOCAL_ISSUER_NAME="${LOCAL_ISSUER_NAME:-converged-local-selfsigned}"
OPERATOR_CREATE="${OPERATOR_CREATE:-}"

# Where `bun run build:modules -p` published. Set it and the platform runs the
# modules in that registry; leave it empty and it runs what is baked into the
# images. Nothing else has to be said: `<url>/registry.json` is written by the
# same build that uploaded the modules, and already holds the digest of every
# one of them.
REGISTRY_URL="${REGISTRY_URL:-}"

if [[ "${EUID}" -ne 0 ]]; then
	printf 'Run this installer as root: curl -sfL <url> | sudo sh -\n' >&2
	exit 1
fi

export KUBECONFIG="$KUBECONFIG_PATH"

# Piped through `sh -`, stdin is the script itself, so a prompt has to talk to
# the terminal directly. Opening /dev/tty is the test that matters: the device
# node exists in containers and CI where it cannot be opened, so checking for
# the file would pass and then read nothing. With no terminal the environment
# is the only input, and an unanswered question fails rather than quietly
# installing a differently-named platform than the one that was wanted.
ask() {
	local var="$1" question="$2" default="$3" answer=""
	if [[ -n "${!var}" ]]; then
		printf '%s: %s\n' "$question" "${!var}"
		return
	fi
	if ! { exec 3<>/dev/tty; } 2>/dev/null; then
		printf 'No terminal to ask "%s"; set %s in the environment.\n' "$question" "$var" >&2
		exit 1
	fi
	printf '%s [%s]: ' "$question" "$default" >&3
	read -r answer <&3 || answer=""
	exec 3>&-
	printf -v "$var" '%s' "${answer:-$default}"
}

# Asked at the end, but checked at the start: finding out there is no terminal
# after several minutes of installing k3s is the one failure worth spending a
# line to move forward.
require_answers_possible() {
	if [[ -n "$WORKSPACE" && -n "$PROFILE" && -n "$DOMAIN_BASE" ]]; then return; fi
	if { exec 3<>/dev/tty; } 2>/dev/null; then
		exec 3>&-
		return
	fi
	printf 'No terminal to prompt on. Set WORKSPACE, PROFILE and DOMAIN_BASE in the environment.\n' >&2
	exit 1
}

ask_workspace() {
	ask WORKSPACE "Workspace (namespace and platform name)" "converged"
	if [[ ! "$WORKSPACE" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]]; then
		printf 'Workspace %q is not a valid namespace name.\n' "$WORKSPACE" >&2
		exit 1
	fi

	ask PROFILE "Deployment type (mono | multi | cloud)" "mono"
	case "$PROFILE" in
		mono|multi|cloud) ;;
		*) printf 'Deployment type must be mono, multi or cloud (got %q).\n' "$PROFILE" >&2; exit 1 ;;
	esac

	ask DOMAIN_BASE "Domain base (hostnames are <name>.<domain>)" "4ir.local"
}

# The probe is expected to fail until it does not, so its own output is noise:
# a screen of "Error from server (NotFound)" reads like a broken installer
# rather than a healthy wait.
wait_for() {
	local description="$1"
	shift
	local attempts=0
	printf 'Waiting for %s' "$description"
	until "$@" >/dev/null 2>&1; do
		attempts=$((attempts + 1))
		if (( attempts >= 150 )); then
			printf '\nTimed out waiting for %s\n' "$description" >&2
			return 1
		fi
		printf '.'
		sleep 2
	done
	printf ' ok\n'
}

# Is there already a cluster with everything a platform needs? Each check names
# one thing install_* would otherwise create, so a half-built cluster — k3s up
# but no cert-manager — is treated as absent and completed rather than assumed
# ready and failed later.
cluster_ready() {
	command -v kubectl >/dev/null 2>&1 || return 1
	systemctl is-active --quiet k3s || return 1
	kubectl get --raw=/readyz >/dev/null 2>&1 || return 1
	kubectl get gatewayclass/traefik >/dev/null 2>&1 || return 1
	kubectl -n cert-manager get deployment/cert-manager >/dev/null 2>&1 || return 1
	kubectl get clusterissuer/"$LOCAL_ISSUER_NAME" >/dev/null 2>&1 || return 1
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
	# The gateway provider is configured before traefik's chart runs: the
	# helm-controller reinstalls traefik when this changes, so setting it first
	# is one install instead of two.
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

	# Traefik ships the Gateway API CRDs in its own `traefik-crd` chart, so they
	# arrive with it. Applying the upstream set first creates the same CRDs
	# without Helm's ownership labels, and `helm install traefik-crd` then
	# refuses to adopt them: traefik fails with "Required CRDs are missing" and
	# there is never a Deployment to wait for. So wait for traefik first, then
	# fill in only what it did not bring.
	wait_for "the traefik Deployment" kubectl -n kube-system get deployment/traefik
	kubectl -n kube-system rollout status deployment/traefik --timeout=5m

	if ! kubectl get crd gatewayclasses.gateway.networking.k8s.io >/dev/null 2>&1; then
		kubectl apply -f "https://github.com/kubernetes-sigs/gateway-api/releases/download/${GATEWAY_API_VERSION}/standard-install.yaml"
	fi

	wait_for "the traefik GatewayClass" kubectl get gatewayclass/traefik
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

unpack_chart() {
	CHART_DIR="$(mktemp -d)"
	trap 'rm -rf "$CHART_DIR"' EXIT
	printf '%s' "$CHART_B64" | base64 -d > "$CHART_DIR/chart.tgz"
	# The digest is what makes a piped installer auditable: a payload that was
	# rewritten in transit fails here rather than in the cluster.
	local actual
	actual="$(sha256sum "$CHART_DIR/chart.tgz" | cut -d' ' -f1)"
	if [[ "$actual" != "$CHART_SHA256" ]]; then
		printf 'Embedded chart digest mismatch: expected %s, got %s\n' "$CHART_SHA256" "$actual" >&2
		exit 1
	fi
	mkdir -p "$CHART_DIR/chart"
	tar -xzf "$CHART_DIR/chart.tgz" -C "$CHART_DIR/chart"
}

# The module map, as chart values.
#
# Fetched rather than reconstructed: the build publishes `registry.json` in the
# exact shape the chart consumes, so there is nothing here to parse and no way
# for this script's idea of the mapping to drift from the registry's. Written
# into the unpacked chart directory, which is a temp dir this script owns.
fetch_registry_values() {
	[[ -n "$REGISTRY_URL" ]] || return 0
	local url="${REGISTRY_URL%/}/registry.json"
	printf 'Registry: %s\n' "$url"
	if ! curl -fsSL "$url" -o "$CHART_DIR/registry.json"; then
		printf 'Could not fetch %s. Unset REGISTRY_URL to install without a registry.\n' "$url" >&2
		exit 1
	fi
	REGISTRY_VALUES_FILE="$CHART_DIR/registry.json"
}

install_ptah() {
	kubectl create namespace "$WORKSPACE" --dry-run=client -o yaml | kubectl apply -f -

	REGISTRY_VALUES_FILE=""
	fetch_registry_values

	# Ptah references this Secret and never writes it: real credentials do not
	# travel through a custom resource, and they do not travel through an
	# installer either.
	if ! kubectl -n "$WORKSPACE" get secret "${WORKSPACE}-secrets" >/dev/null 2>&1; then
		printf 'Note: Secret %s/%s-secrets does not exist yet. Create it before the platform can serve traffic.\n' \
			"$WORKSPACE" "$WORKSPACE" >&2
	fi

	# The first release in a cluster brings the operator; later ones add a
	# Platform and let that operator drive it. Both Platform and Solution are
	# cluster-scoped, so a second operator would reconcile everything twice.
	if [[ -z "$OPERATOR_CREATE" ]]; then
		if kubectl get crd platforms.ptah.io >/dev/null 2>&1 \
			&& [[ -n "$(kubectl get deployment -A -l app.kubernetes.io/name=ptah -o name 2>/dev/null)" ]]; then
			OPERATOR_CREATE=false
		else
			OPERATOR_CREATE=true
		fi
	fi
	printf 'Operator: %s\n' "$([[ "$OPERATOR_CREATE" == true ]] && echo "installing" || echo "already present, adding a Platform only")"

	helm upgrade --install "${WORKSPACE}-ptah" "$CHART_DIR/chart" \
		--namespace "$WORKSPACE" \
		--create-namespace \
		--wait \
		${REGISTRY_VALUES_FILE:+--values "$REGISTRY_VALUES_FILE"} \
		--set operator.create="$OPERATOR_CREATE" \
		--set-string workspace="$WORKSPACE" \
		--set-string profile="$PROFILE" \
		--set-string domainBase="$DOMAIN_BASE" \
		--set-string image.repository="$PTAH_IMAGE_REPOSITORY" \
		--set-string image.tag="$PTAH_IMAGE_TAG" \
		--set-string images.registry="$IMAGES_REGISTRY" \
		--set-string images.tag="$IMAGES_TAG" \
		--set-string storage.storageClassName="$STORAGE_CLASS" \
		--set-string storage.size="$STORAGE_SIZE" \
		--set-string gateway.issuer="$LOCAL_ISSUER_NAME" \
		--set gateway.httpsPort="$TRAEFIK_HTTPS_ENTRYPOINT_PORT"

	if [[ "$OPERATOR_CREATE" == true ]]; then
		kubectl -n "$WORKSPACE" rollout status deployment/"${WORKSPACE}-ptah" --timeout=5m
	fi
	wait_for "the Gateway to be programmed" sh -c \
		"kubectl get gateway -n '$WORKSPACE' '$WORKSPACE' -o jsonpath='{.status.conditions[?(@.type==\"Programmed\")].status}' | grep -qx True"
}

printf 'Converged installer (chart %s, built %s)\n\n' "${CHART_SHA256:0:12}" "$CHART_BUILT"
require_answers_possible

# The cluster and its add-ons are the same whatever the answers turn out to be,
# so they are built first and the questions are asked once there is something
# to install into. On a host that already has them this is the whole difference
# between installing a cluster and adding a workspace to one.
install_helm
if cluster_ready; then
	printf 'Found k3s with traefik, the Gateway API and cert-manager. Adding a workspace to it.\n'
else
	install_k3s
	install_gateway_api
	install_cert_manager
	install_local_issuer
fi

printf '\nCluster is ready. Now the platform:\n\n'
ask_workspace
printf '\n'

unpack_chart
install_ptah

printf '\nConverged is installed in namespace %s (%s). Gateway: https://%s.%s/\n' \
	"$WORKSPACE" "$PROFILE" "$WORKSPACE" "$DOMAIN_BASE"
