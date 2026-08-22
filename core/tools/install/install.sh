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
CHART_SHA256='744721cc9edee843ee65fa038914899db44e4f66826c54ca0cb1bf405cf8a0ac'
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
# The installer brings up k3s, which ships the local-path provisioner, so the
# claims ptah writes have something to answer them and the volumes are the
# provisioner's to create and to clean up. Point STORAGE_CLASS at another class
# on a cluster with real storage; the static form, where ptah declares the
# volumes itself, is a chart value and deliberately not a question here.
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

# A missing k3s binary with its data directory still present is an incomplete
# uninstall, not a stopped cluster. K3s keeps its CA, serving certificates and
# bootstrap data together, so deleting only one certificate leaves the next
# server unable to trust its own persisted state. Start a genuinely new
# cluster by removing that orphaned state before the installer recreates k3s.
reset_orphaned_k3s_state() {
	if command -v k3s >/dev/null 2>&1 || [[ -x /usr/local/bin/k3s ]]; then
		return
	fi
	if [[ -e /etc/rancher/k3s || -e /var/lib/rancher/k3s ]]; then
		printf 'Removing orphaned k3s state and certificates from an incomplete uninstall.\n'
		rm -rf -- /etc/rancher/k3s /var/lib/rancher/k3s
	fi
}

# K3s generates a new CA for a new cluster, while `kubectl` without
# KUBECONFIG reads ~/.kube/config. Rebuild that config from the authoritative
# k3s file on every install. The merge retains unrelated contexts, but puts
# the fresh k3s `default` context first so a plain `kubectl get pods` cannot
# continue using a CA copied from a deleted cluster.
#
# Called from inside install_k3s rather than at the end of the run.
# Everything after k3s comes up can fail, and `set -e` then abandons the
# script — with the sync last, a cert-manager that never went Ready left
# the caller with a brand new cluster and their old cluster's CA. That
# does not read as an unfinished install: every later kubectl reports a
# certificate signed by an unknown authority, as though the cluster
# itself were broken.
sync_user_kubeconfig() {
	local install_user="${SUDO_USER:-root}" install_home user_uid user_gid
	local config_dir config_file temp_config

	install_home="$(getent passwd "$install_user" | cut -d: -f6)"
	if [[ -z "$install_home" ]]; then
		printf 'Could not find home directory for %s; kubectl config was not updated.\n' "$install_user" >&2
		return
	fi
	user_uid="$(id -u "$install_user")"
	user_gid="$(id -g "$install_user")"
	config_dir="$install_home/.kube"
	config_file="$config_dir/config"

	install -d -m 700 -o "$user_uid" -g "$user_gid" "$config_dir"
	temp_config="$(mktemp "$config_dir/.config.XXXXXX")"
	if [[ -s "$config_file" ]] \
		&& KUBECONFIG="$KUBECONFIG_PATH:$config_file" kubectl config view --raw --flatten > "$temp_config"; then
		:
	else
		# A malformed old config must not block the install or retain its CA.
		cp "$KUBECONFIG_PATH" "$temp_config"
	fi
	chmod 600 "$temp_config"
	chown "$user_uid:$user_gid" "$temp_config"
	mv -f "$temp_config" "$config_file"
}

# The sync is silent about whether it worked, and a wrong CA is indistinguishable
# from a down cluster at the next prompt. One call through the file that was just
# written turns that into a line naming the file to fix.
verify_user_kubeconfig() {
	local install_user="${SUDO_USER:-root}" install_home config_file
	install_home="$(getent passwd "$install_user" | cut -d: -f6)" || return 0
	[[ -n "$install_home" ]] || return 0
	config_file="$install_home/.kube/config"
	[[ -s "$config_file" ]] || return 0
	if ! KUBECONFIG="$config_file" kubectl get --raw=/readyz >/dev/null 2>&1; then
		printf 'Warning: %s cannot reach the cluster; kubectl will keep failing until it is replaced with %s.\n' \
			"$config_file" "$KUBECONFIG_PATH" >&2
	fi
}

install_k3s() {
	if ! systemctl is-active --quiet k3s; then
		reset_orphaned_k3s_state
		curl -sfL https://get.k3s.io | sh -
		# The new CA is on disk the moment the installer returns, and the two
		# waits below are the first thing that can time out. Sync here so a
		# cluster that never becomes ready still leaves a kubectl pointed at it
		# rather than at the CA of the cluster it replaced.
		sync_user_kubeconfig
	fi
	wait_for "k3s API" kubectl get --raw=/readyz
	wait_for "a Ready node" sh -c 'kubectl get nodes --no-headers 2>/dev/null | awk '\''$2 == "Ready" { found=1 } END { exit !found }'\'''
	# Again, for the path where k3s was already running: it may have been
	# reinstalled out of band since this last ran, and the branch above would
	# not have noticed. Now that the API answers, the result can be checked.
	sync_user_kubeconfig
	verify_user_kubeconfig
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
	# cluster-scoped, so a second operator would reconcile everything twice. A
	# repeat of this release is different: its controller is part of the same
	# Helm release and must stay enabled, otherwise Helm deletes it on upgrade.
	if [[ -z "$OPERATOR_CREATE" ]]; then
		if helm -n "$WORKSPACE" status "${WORKSPACE}-ptah" >/dev/null 2>&1; then
			OPERATOR_CREATE=true
		elif kubectl get crd platforms.ptah.io >/dev/null 2>&1 \
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
		--set-string storage.mode=dynamic \
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
	# This branch never calls install_k3s, so it is the one place the sync has
	# to be spelled out: the cluster being complete says nothing about whether
	# it is the same cluster the user's config was written for.
	sync_user_kubeconfig
	verify_user_kubeconfig
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
