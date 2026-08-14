import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link2, Share2, Twitter, Facebook, Linkedin, Mail } from "lucide-react";

const SITE_URL = "https://stocklyai.lovable.app";
const SITE_TITLE = "STOCKLYAI";

const QUOTES = [
  {
    text: "The stock market is a device for transferring money from the impatient to the patient.",
    author: "Warren Buffett",
  },
  {
    text: "In investing, what is comfortable is rarely profitable.",
    author: "Robert Arnott",
  },
  {
    text: "Price is what you pay. Value is what you get.",
    author: "Warren Buffett",
  },
  {
    text: "The individual investor should act consistently as an investor and not as a speculator.",
    author: "Ben Graham",
  },
  {
    text: "Compound interest is the eighth wonder of the world. He who understands it, earns it.",
    author: "Albert Einstein",
  },
  {
    text: "Know what you own, and know why you own it.",
    author: "Peter Lynch",
  },
  {
    text: "The best investment you can make is in yourself.",
    author: "Warren Buffett",
  },
];

function getDailyQuoteIndex() {
  const dateKey = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash << 5) - hash + dateKey.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % QUOTES.length;
}

const SiteFooter = () => {
  const quote = useMemo(() => QUOTES[getDailyQuoteIndex()], []);
  const shareText = useMemo(
    () => `"${quote.text}" — ${quote.author}\n\nExplore ${SITE_TITLE}: ${SITE_URL}`,
    [quote]
  );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}`);
      toast.success("Site link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: SITE_TITLE,
          text: shareText,
          url: SITE_URL,
        });
        return;
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    await handleCopyLink();
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(`Insight from ${SITE_TITLE}`)}&body=${encodeURIComponent(shareText)}`;

  return (
    <footer className="border-t border-border bg-secondary/20 px-6 md:px-10 py-8 mt-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <blockquote className="max-w-2xl">
          <p className="text-lg md:text-xl font-serif italic text-foreground leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <cite className="mt-2 block text-sm font-mono text-muted-foreground not-italic">
            &mdash; {quote.author}
          </cite>
        </blockquote>

        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Share this insight
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              aria-label="Copy site link"
              className="h-9 w-9"
            >
              <Link2 className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleNativeShare}
              aria-label="Share using your device"
              className="h-9 w-9"
            >
              <Share2 className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" asChild className="h-9 w-9" aria-label="Share on X">
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
                <Twitter className="h-4 w-4" />
              </a>
            </Button>

            <Button variant="outline" size="icon" asChild className="h-9 w-9" aria-label="Share on Facebook">
              <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                <Facebook className="h-4 w-4" />
              </a>
            </Button>

            <Button variant="outline" size="icon" asChild className="h-9 w-9" aria-label="Share on LinkedIn">
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                <Linkedin className="h-4 w-4" />
              </a>
            </Button>

            <Button variant="outline" size="icon" asChild className="h-9 w-9" aria-label="Share by email">
              <a href={emailUrl} target="_blank" rel="noopener noreferrer">
                <Mail className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <div className="text-[11px] font-mono text-muted-foreground">
          {SITE_URL}
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
