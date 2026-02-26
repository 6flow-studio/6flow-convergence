#!/usr/bin/env bash
set -euo pipefail

SOURCE_OWNER=""
SOURCE_REPO=""
TAG=""
BINARY_NAME="6flow"
OUTPUT_PATH=""

usage() {
  cat <<'EOF'
Usage:
  prepare-homebrew-formula.sh \
    --source-owner <owner> \
    --source-repo <repo> \
    --tag <tag> \
    [--binary-name <name>] \
    [--output <path>]

Example:
  bash tools/tui/scripts/prepare-homebrew-formula.sh \
    --source-owner 6flow-studio \
    --source-repo 6flow-convergence \
    --tag v0.0.1 \
    --output /tmp/tui.rb
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-owner)
      SOURCE_OWNER="${2:-}"
      shift 2
      ;;
    --source-repo)
      SOURCE_REPO="${2:-}"
      shift 2
      ;;
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --binary-name)
      BINARY_NAME="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$SOURCE_OWNER" || -z "$SOURCE_REPO" || -z "$TAG" ]]; then
  echo "Missing required arguments." >&2
  usage
  exit 1
fi

TARBALL_URL="https://github.com/${SOURCE_OWNER}/${SOURCE_REPO}/archive/refs/tags/${TAG}.tar.gz"
TMP_ARCHIVE="$(mktemp /tmp/tui-tarball.XXXXXX.tar.gz)"
trap 'rm -f "$TMP_ARCHIVE"' EXIT

echo "Downloading: ${TARBALL_URL}" >&2
curl -fsSL "$TARBALL_URL" -o "$TMP_ARCHIVE"
SHA256="$(shasum -a 256 "$TMP_ARCHIVE" | awk '{print $1}')"

FORMULA_CONTENT="$(cat <<EOF
class Tui < Formula
  desc "6Flow terminal UI"
  homepage "https://github.com/${SOURCE_OWNER}/${SOURCE_REPO}"
  url "${TARBALL_URL}"
  sha256 "${SHA256}"

  depends_on "go" => :build

  def install
    cd "tools/tui" do
      system "go", "build", *std_go_args(output: bin/"${BINARY_NAME}"), "./cmd/tui"
    end
  end

  test do
    assert_predicate bin/"${BINARY_NAME}", :exist?
  end
end
EOF
)"

if [[ -n "$OUTPUT_PATH" ]]; then
  printf '%s\n' "$FORMULA_CONTENT" > "$OUTPUT_PATH"
  echo "Formula written to ${OUTPUT_PATH}" >&2
else
  printf '%s\n' "$FORMULA_CONTENT"
fi
