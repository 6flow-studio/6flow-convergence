class Tui < Formula
  desc "6Flow terminal UI"
  homepage "https://github.com/6flow-studio/6flow-convergence"
  url "https://github.com/6flow-studio/6flow-convergence/archive/refs/tags/v0.0.1.tar.gz"
  sha256 "REPLACE_WITH_TARBALL_SHA256"

  depends_on "go" => :build

  def install
    cd "tools/tui" do
      system "go", "build", *std_go_args(output: bin/"6flow"), "./cmd/tui"
    end
  end

  test do
    assert_predicate bin/"6flow", :exist?
  end
end
