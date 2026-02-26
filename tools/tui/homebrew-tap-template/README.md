# Homebrew Tap Template

This folder is a template for a tap that supports:

`brew install 6flow-studio/6flow-convergence/tui`

## 1. Create tap repo

Homebrew expects:

- install path: `<user>/<repo>/tui`
- GitHub repo: `<user>/homebrew-<repo>`

For this project:

- install path: `6flow-studio/6flow-convergence/tui`
- tap repo: `github.com/6flow-studio/homebrew-6flow-convergence`

## 2. Prepare release tarball sha256

Run helper script from this repo root:

```bash
  bash tools/tui/scripts/prepare-homebrew-formula.sh \
    --source-owner 6flow-studio \
    --source-repo 6flow-convergence \
    --tag v0.0.1 \
    --output /tmp/tui.rb
```

Then copy generated `/tmp/tui.rb` into your tap repo at `Formula/tui.rb`.

## 3. Publish tap

```bash
git clone git@github.com:6flow-studio/homebrew-6flow-convergence.git
cd homebrew-6flow-convergence
mkdir -p Formula
cp /tmp/tui.rb Formula/tui.rb
git add Formula/tui.rb
git commit -m "Add/update tui formula"
git push
```

## 4. User install command

```bash
brew install 6flow-studio/6flow-convergence/tui
```
