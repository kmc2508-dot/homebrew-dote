class Dote < Formula
  desc "dot e command"
  homepage "https://github.com/kmc2508-dot/homebrew-dote"
  url "https://raw.githubusercontent.com/kmc2508-dot/homebrew-dote/main/dote.c"
  sha256 "71cf3a9cf740519a13347f4a02b27e3e2818b225123ffceaf4ced749abff6b76"
  version "1.0.0"

  def install
    system ENV.cc, "dote.c", "-o", "dote"
    bin.install "dote"
  end
end
