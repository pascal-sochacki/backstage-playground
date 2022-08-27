https://fluxcd.io/docs/guides/image-update/#prerequisites

```[shell]
export GITHUB_TOKEN=<token>
export GITHUB_USER=pascal-sochacki
```

```[shell]
flux bootstrap github \
--components-extra=image-reflector-controller,image-automation-controller \
--owner=$GITHUB_USER \
--repository=backstage-playground-deployment \
--branch=main \
--read-write-key \
--personal
```

```[shell]
helm install sealed-secrets -n kube-system --set-string fullnameOverride=sealed-secrets-controller sealed-secrets/sealed-secrets 
```
