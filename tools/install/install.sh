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
CHART_SHA256='5ac8ea1abc0d70c6666cd04e262d68a455ac6a59f0350631669d3bd532f7c980'
CHART_BUILT='2026-09-02'

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
# The controller is cluster infrastructure, not part of a workspace, so it has
# a namespace and a release name of its own and neither is derived from the
# answers below.
OPERATOR_NAMESPACE="${OPERATOR_NAMESPACE:-kube-system}"
OPERATOR_RELEASE="${OPERATOR_RELEASE:-ptah}"
# The operator caches fetched modules on a claim. Defaults to the same class the
# platform's volumes use, which on a k3s install is the provisioner k3s ships;
# empty falls through to the cluster's default class.
MODULE_CACHE_STORAGE_CLASS="${MODULE_CACHE_STORAGE_CLASS:-$STORAGE_CLASS}"

# Where `bun run build:modules -p` published. Set it and the platform runs the
# modules in that registry; leave it empty and it runs what is baked into the
# images. Nothing else has to be said: `<url>/registry.json` is written by the
# same build that uploaded the modules, and already holds the digest of every
# one of them.
REGISTRY_URL="${REGISTRY_URL:-}"
REGISTRY_INDEX_URL="${REGISTRY_INDEX_URL:-}"
if [[ -z "$REGISTRY_INDEX_URL" && -n "$REGISTRY_URL" ]]; then
	REGISTRY_INDEX_URL="${REGISTRY_URL%/}/registry.json"
fi

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

# The operator, once per cluster, in kube-system.
#
# Platform, Solution and Tenant are cluster-scoped and ptah lists them without a
# namespace filter, so one controller already drives every workspace — what it
# must not be is a part of any one of them. Installed beside a platform it is
# owned by that platform's Helm release, and `helm uninstall <workspace>-ptah`
# then takes the controller down with it, leaving every other workspace
# unreconciled. kube-system is where a thing that outlives its tenants belongs.
install_operator() {
	printf 'Operator: %s in %s\n' \
		"$(helm -n "$OPERATOR_NAMESPACE" status "$OPERATOR_RELEASE" >/dev/null 2>&1 && echo upgrading || echo installing)" \
		"$OPERATOR_NAMESPACE"

	helm upgrade --install "$OPERATOR_RELEASE" "$CHART_DIR/chart" \
		--namespace "$OPERATOR_NAMESPACE" \
		--wait \
		--set operator.create=true \
		--set platform.create=false \
		--set-string image.repository="$PTAH_IMAGE_REPOSITORY" \
		--set-string image.tag="$PTAH_IMAGE_TAG" \
		--set-string operator.registryIndexUrl="$REGISTRY_INDEX_URL" \
		--set-string moduleCache.storageClassName="$MODULE_CACHE_STORAGE_CLASS"

	kubectl -n "$OPERATOR_NAMESPACE" rollout status deployment/"$OPERATOR_RELEASE" --timeout=5m
}

# The workspace: a Platform and its Solutions, and never a controller. Passing
# `operator.create=false` unconditionally is also the migration path — a cluster
# whose controller still lives inside a workspace release loses it on this
# upgrade, which is safe only because install_operator has already put one in
# kube-system.
install_platform() {
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

	helm upgrade --install "${WORKSPACE}-ptah" "$CHART_DIR/chart" \
		--namespace "$WORKSPACE" \
		--create-namespace \
		--wait \
		${REGISTRY_VALUES_FILE:+--values "$REGISTRY_VALUES_FILE"} \
		--set operator.create=false \
		--set platform.create=true \
		--set-string workspace="$WORKSPACE" \
		--set-string profile="$PROFILE" \
		--set-string domainBase="$DOMAIN_BASE" \
		--set-string images.registry="$IMAGES_REGISTRY" \
		--set-string images.tag="$IMAGES_TAG" \
		--set-string storage.mode=dynamic \
		--set-string storage.storageClassName="$STORAGE_CLASS" \
		--set-string storage.size="$STORAGE_SIZE" \
		--set-string gateway.issuer="$LOCAL_ISSUER_NAME" \
		--set gateway.httpsPort="$TRAEFIK_HTTPS_ENTRYPOINT_PORT"

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
install_operator
install_platform

printf '\nConverged is installed in namespace %s (%s).\n' "$WORKSPACE" "$PROFILE"
# Which hostname to open follows the profile, so this cannot be one line: mono
# and multi answer on the base domain, while cloud has no platform-wide name at
# all — the Gateway listens on the whole zone and each Tenant brings the name it
# serves, so there is nothing to visit until the first one is created.
if [[ "$PROFILE" == "cloud" ]]; then
	printf 'Gateway listens on *.%s; a site answers at <tenant>.%s once you create a Tenant.\n' \
		"$DOMAIN_BASE" "$DOMAIN_BASE"
else
	printf 'Gateway: https://%s/\n' "$DOMAIN_BASE"
fi
