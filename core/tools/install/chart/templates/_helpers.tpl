{{/*
Names only.

There is no validation here. The policy inside ptah is the single validator of
a Platform spec, and a second copy of those rules in Go templates could only
ever disagree with it — a chart that accepts what the operator rejects, or
refuses what it would have accepted.
*/}}

{{- define "ptah.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ptah.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
The workspace: the Platform's name and the namespace its workloads land in.
Defaults to the release namespace, so a plain `helm install -n <ns>` needs no
second setting to say the same thing twice.
*/}}
{{- define "ptah.workspace" -}}
{{- default .Release.Namespace .Values.workspace -}}
{{- end -}}

{{/*
The class the `static` storage mode binds its volumes and claims under. Empty
in values means the chart owns one, named after the workspace; set means the
cluster already has one and the chart only refers to it.
*/}}
{{- define "ptah.staticStorageClass" -}}
{{- default (printf "%s-local" (include "ptah.workspace" .)) .Values.storage.static.storageClassName -}}
{{- end -}}

{{- define "ptah.profile" -}}
{{- .Values.profile -}}
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
