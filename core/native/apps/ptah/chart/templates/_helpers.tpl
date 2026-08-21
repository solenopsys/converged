{{/*
Names and the validation that runs before anything is rendered.

Every check here is a `fail`: a mistake in these values produces a platform
that installs cleanly and then does the wrong thing quietly — storage under a
class that does not exist, two microservices sharing a disk, a `multi` platform
with no shards. Refusing at template time costs a re-run; the alternative costs
a debugging session against a live cluster.
*/}}

{{- define "ptah.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ptah.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "ptah.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "ptah.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: operator
{{- end -}}

{{- define "ptah.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ptah.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "ptah.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "ptah.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
The namespace the platform's workloads land in. Defaults to the release
namespace so a plain `helm install -n converged` needs no second setting, but
stays overridable for an operator that manages a namespace it does not run in.
*/}}
{{- define "ptah.platformNamespace" -}}
{{- default .Release.Namespace .Values.platform.spec.namespace -}}
{{- end -}}

{{/*
The Platform spec, validated and completed. Returns YAML.
*/}}
{{- define "ptah.platformSpec" -}}
{{- $spec := deepCopy .Values.platform.spec -}}
{{- $profile := $spec.profile | default "" -}}
{{- if not (has $profile (list "mono" "multi" "cloud")) -}}
{{- fail (printf "platform.spec.profile must be one of mono, multi, cloud (got %q)" $profile) -}}
{{- end -}}

{{- if eq $profile "multi" -}}
{{- if not $spec.shards -}}
{{- fail "profile multi requires platform.spec.shards; a shard set is how multi differs from mono" -}}
{{- end -}}
{{- $catchAll := 0 -}}
{{- range $spec.shards -}}
{{- if has "*" (.scopes | default list) -}}{{- $catchAll = add1 $catchAll -}}{{- end -}}
{{- end -}}
{{- if ne $catchAll 1 -}}
{{- fail (printf "profile multi needs exactly one shard claiming scopes: [\"*\"] (found %d); without it an unknown scope has nowhere to go" $catchAll) -}}
{{- end -}}
{{- else -}}
{{/* Only multi reads shards; carrying an empty list into the other profiles
     would suggest the field means something there. */}}
{{- $spec = omit $spec "shards" -}}
{{- end -}}

{{- if not $spec.storage.storageClassName -}}
{{- fail "platform.spec.storage.storageClassName is required: the cluster default class differs per cluster, so leaving it unset makes the same values mean different storage" -}}
{{- end -}}
{{- if not $spec.storage.volumeSource -}}
{{- fail "platform.spec.storage.volumeSource is required: every microservice needs its own volume and ptah builds each one from this template" -}}
{{- end -}}

{{- $registry := $spec.registry | default dict -}}
{{- if $registry.url -}}
{{- if not $registry.solutions -}}
{{- fail "platform.spec.registry.url is set without registry.solutions; a registry with no solution key is a URL nobody reads" -}}
{{- end -}}
{{- else -}}
{{- $spec = omit $spec "registry" -}}
{{- end -}}

{{- if not (dig "fujin" "ports" "zmq" nil $spec.apps) -}}
{{- fail "platform.spec.apps.fujin.ports.zmq is required: every other peer dials that socket" -}}
{{- end -}}
{{- if not (dig "fujin" "ports" "ws" nil $spec.apps) -}}
{{- fail "platform.spec.apps.fujin.ports.ws is required: it is what the gateway routes /ws to" -}}
{{- end -}}

{{- $_ := set $spec "namespace" (include "ptah.platformNamespace" .) -}}
{{- toYaml $spec -}}
{{- end -}}
