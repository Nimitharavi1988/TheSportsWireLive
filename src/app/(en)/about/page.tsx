import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { db } from "@/db";
import { article, author } from "@/db/schema";
import { and, asc, count, eq } from "drizzle-orm";
import { ORIGINAL_SOURCE } from "@/lib/stories";

// Rewritten 2026-10-04 around the people and process behind the site (it
// used to describe the site only as a news aggregator). The team list is
// read from the writers' own records, so a bio added in admin (Write a
// story > Short bio) shows here without a code change, and nothing about a
// writer is written that they didn't write themselves.
export const revalidate = 3600;

export const metadata = {
  title: "About",
  alternates: { canonical: "/about" },
  description: "Who publishes Sports Wire Live, the writers behind our analysis, how our coverage is produced and checked, and how we use AI.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      <Typography
        variant="body1"
        component="div"
        sx={{
          color: "text.secondary",
          "& p": { mb: 1.5 }
        }}>
        {children}
      </Typography>
    </Box>
  );
}

// Writers with at least one published story, most prolific first.
async function fetchTeam() {
  try {
    return await db
      .select({ slug: author.slug, name: author.name, bio: author.bio, stories: count(article.id) })
      .from(author)
      .innerJoin(article, and(eq(article.authorSlug, author.slug), eq(article.status, "published"), eq(article.sourceName, ORIGINAL_SOURCE)))
      .groupBy(author.slug, author.name, author.bio)
      .orderBy(asc(author.name));
  } catch {
    return [];
  }
}

export default async function AboutPage() {
  const team = (await fetchTeam()).sort((a, b) => b.stories - a.stories);
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        About Sports Wire Live
      </Typography>

      <Section title="Who we are">
        <p>
          Sports Wire Live is a sports news site covering football, cricket, the NFL, college football,
          the NBA, WNBA, MLB, NHL, rugby, athletics, volleyball, Formula 1 and more: live scores and
          standings, match previews and reports, and analysis from our own writers. It is published by
          HyperianAI LLC, a limited liability company registered in Arkansas, USA.
        </p>
      </Section>

      {team.length > 0 && (
        <Section title="Our writers">
          <p>
            Our previews, analysis, features and match reports are written and signed by these writers.
            Each piece carries its writer&apos;s name, and you can read all of their work on their page.
          </p>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {team.map((w) => (
              <Box component="li" key={w.slug} sx={{ mb: 1.5 }}>
                <Link href={`/author/${w.slug}`} style={{ fontWeight: 600 }}>{w.name}</Link>
                {w.bio ? <> — {w.bio}</> : null}
              </Box>
            ))}
          </Box>
        </Section>
      )}

      <Section title="How our coverage is produced">
        <p>
          <strong>Analysis and original stories.</strong> Pieces under a writer&apos;s byline are
          researched from official league, team and governing-body sources and established sports
          outlets, checked for accuracy, and published by that writer. Every fact in them is meant to be
          checkable; we don&apos;t invent quotes, numbers or details.
        </p>
        <p>
          <strong>News from other publishers.</strong> We also follow what the world&apos;s sports
          outlets are reporting. These stories are short summaries in our own words that clearly credit
          and link to the publisher that first reported them. We never republish another outlet&apos;s
          article.
        </p>
        <p>
          <strong>Expanded reports.</strong> Some of the day&apos;s biggest stories are developed into
          fuller reports drawing on several outlets&apos; coverage. These still credit the original
          publisher and name the other outlets they draw on.
        </p>
        <p>
          <strong>Scores and standings</strong> come from public sports data sources and update
          automatically.
        </p>
      </Section>

      <Section title="How we use AI">
        <p>
          We use AI tools to help with parts of our work: summarising other outlets&apos; reporting,
          researching facts across sources, preparing first drafts for our writers, writing the expanded
          reports described above, and checking drafts against the research. AI does not replace our
          writers&apos; judgement: a piece goes out under a writer&apos;s name only after that writer has
          read, edited and approved it. Material produced with AI is held to the same rule as everything
          else: only facts we can trace to a source, never invented quotes or details.
        </p>
      </Section>

      <Section title="Photos">
        <p>
          Photos are either licensed for reuse (such as Creative Commons images from Wikimedia Commons,
          credited to the photographer with a link to the licence) or credited to the publisher whose
          story they accompany.
        </p>
      </Section>

      <Section title="Corrections">
        <p>
          We aim to get every detail right, and when we don&apos;t, we fix it. If you spot an error in
          anything we&apos;ve published, email us at the address below with a link to the page and
          we&apos;ll correct it promptly.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions, corrections, or anything else: <a href="mailto:contact@hyperianai.com">contact@hyperianai.com</a>.
        </p>
      </Section>
    </Container>
  );
}
