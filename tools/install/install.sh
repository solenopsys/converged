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
CHART_SHA256='27b8a876d8aeef06e3ed80d273b59e955bba2e6537f4ea3003f7e24f2ad745ac'
CHART_BUILT='2026-09-25'

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
