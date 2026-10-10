#!/usr/bin/env bash
# Publishes generated documents to the "deliverables" branch, an orphan branch that shares no
# history with main, so GitHub can't open a pull request from it and deliverables never get merged.
#
# Usage:  bash scripts/publish-deliverable.sh output/<name> [output/<other> ...]
#         (a folder publishes all its .pdf and .content.json files; single files work too)
# Each document lands in <name>/ on the branch; republishing the same name overwrites it.
# Env:    ONEPAGER_DELIVERABLES_REMOTE (default: origin)
#         ONEPAGER_DELIVERABLES_BRANCH (default: deliverables)
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${ONEPAGER_DELIVERABLES_REMOTE:-origin}"
BRANCH="${ONEPAGER_DELIVERABLES_BRANCH:-deliverables}"

if [[ $# -lt 1 ]]; then
  echo "usage: bash scripts/publish-deliverable.sh output/<name> [more paths...]" >&2
  exit 1
fi

# Collect files to publish: PDFs and .content.json sidecars only.
files=()
for arg in "$@"; do
  if [[ -d "$arg" ]]; then
    while IFS= read -r -d '' f; do files+=("$f"); done \
      < <(find "$arg" -maxdepth 1 -type f \( -name '*.pdf' -o -name '*.content.json' \) -print0)
  elif [[ -f "$arg" && ( "$arg" == *.pdf || "$arg" == *.content.json ) ]]; then
    files+=("$arg")
  else
    echo "skip: $arg (not a folder, .pdf or .content.json)" >&2
  fi
done
if [[ ${#files[@]} -eq 0 ]]; then
  echo "nothing to publish" >&2
  exit 1
fi

WT="$(mktemp -d)"
ROOT="$(pwd)"
cleanup() { cd "$ROOT"; git worktree remove --force "$WT" >/dev/null 2>&1 || true; rm -rf "$WT"; }
trap cleanup EXIT

if git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  git fetch -q "$REMOTE" "$BRANCH"
  git worktree add -q --detach "$WT" FETCH_HEAD
else
  # First publish: start an orphan branch with only a README.
  git worktree add -q --detach "$WT" HEAD
  (
    cd "$WT"
    git checkout -q --orphan "$BRANCH-new"
    git rm -rfq .
    cat > README.md <<'EOF'
# Deliverables

Generated documents published by `scripts/publish-deliverable.sh`, one folder per document.
This branch has no shared history with `main` and is never merged. Download PDFs from here.
EOF
    git -c core.autocrlf=false add README.md
  )
fi

names=()
for f in "${files[@]}"; do
  name="$(basename "$(dirname "$f")")"
  [[ "$name" == "output" || "$name" == "." ]] && name="$(basename "$f" | sed -E 's/(\.[a-z-]+)?\.(pdf|content\.json)$//')"
  mkdir -p "$WT/$name"
  cp "$f" "$WT/$name/"
  names+=("$name")
done
mapfile -t names < <(printf '%s\n' "${names[@]}" | sort -u)

cd "$WT"
git -c core.autocrlf=false add -A
if git diff --cached --quiet; then
  echo "deliverables: already up to date"
  exit 0
fi
git commit -q -m "Publish ${names[*]}"
git push -q "$REMOTE" "HEAD:refs/heads/$BRANCH"
cd - >/dev/null

url="$(git remote get-url "$REMOTE" 2>/dev/null | sed -E 's#^git@github.com:#https://github.com/#; s#\.git$##')"
for name in "${names[@]}"; do
  if [[ "$url" == https://github.com/* ]]; then
    echo "published: $url/tree/$BRANCH/$name"
  else
    echo "published: $name/ on branch $BRANCH"
  fi
done
