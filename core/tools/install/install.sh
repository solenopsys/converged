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
CHART_SHA256='f734be2bbb7a74548995b67b244782637a56c90585d62fd2cd280f79fc722ae7'
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
