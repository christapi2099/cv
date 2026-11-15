/**
 * THE canonical CV source (plan.md §2, Phase 4.6).
 *
 * The `/cv` route and the CI-generated `dist/cv/tapia-resume.pdf` both render
 * from this file; neither may hard-code its own copy. Keep entries traceable:
 * quantitative claims belong in the case studies' `claim_source` ledgers, and
 * technologies listed here must map to a real artifact (D-C: NestJS, Payload
 * CMS, and MySQL are ledger-only and never appear in UI data).
 */

export interface CvLink {
  label: string;
  href: string;
}

export interface CvExperience {
  company: string;
  role: string;
  /** Kept as prose so an uncertain start date is never invented. */
  period: string;
  location?: string;
  summary: string;
  highlights: readonly string[];
  technologies: readonly string[];
  href?: string;
}

export interface CvEducation {
  institution: string;
  degree: string;
  period: string;
  detail: string;
  href?: string;
}

export interface CvCertification {
  name: string;
  issuer: string;
  /** docs/credentials.md: issue year 2026; exact day is not public yet. */
  date: string;
  note: string;
  /** Omitted until the owner supplies the verification URL (docs/credentials.md). */
  url?: string;
}

export interface CvSkillGroup {
  label: string;
  items: readonly string[];
}

export interface CvSelectedWork {
  title: string;
  href: string;
  summary: string;
}

export interface CvData {
  name: string;
  headline: string;
  positioning: string;
  summary: string;
  location: string;
  /** Carried over from the pre-revamp site; swap when a domain mailbox is supplied. */
  email: string;
  links: readonly CvLink[];
  experience: readonly CvExperience[];
  education: readonly CvEducation[];
  certifications: readonly CvCertification[];
  skills: readonly CvSkillGroup[];
  selectedWork: readonly CvSelectedWork[];
  updated: string;
}

export const CV_PDF_BASENAME = 'tapia-resume';
export const CV_PDF_ROUTE = `/cv/${CV_PDF_BASENAME}.pdf`;

const UCI_ARTICLE =
  'https://ics.uci.edu/2026/03/19/from-project-expo-to-cto-alumnus-christopher-tapia-kicked-his-career-into-high-gear/';

export const CV: CvData = {
  name: 'Christopher Tapia',
  headline: 'Full-stack engineer · Co-founder & CTO, RollTrackApp',
  positioning: 'Full-stack · Stripe Connect · LiveKit · Performance',
  summary:
    'Full-stack engineer and co-founder & CTO of RollTrackApp. I build production web software end to end — database schema to deployed pixel — with a focus on marketplace payments (Stripe Connect), real-time video (LiveKit), and performance-first architecture. UC Irvine Informatics ’25, first-generation student.',
  location: 'Irvine, California',
  // Owner decision 2026-11-15: public contact uses a DuckDuckGo email mask
  // (forwards to the real inbox; kill-switch if it ever gets spammed).
  // Migration path: Cloudflare Email Routing on contact@christopher-tapia.com
  // once the domain is on Cloudflare — single change point is this field.
  email: 'contactchristophertapia@duck.com',
  links: [
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/christopher-tapia-439897198/',
    },
    { label: 'GitHub', href: 'https://github.com/christapi2099' },
    { label: 'RollTrackApp', href: 'https://rolltrackapp.com' },
    {
      label: 'SAHA Collective',
      href: 'https://www.linkedin.com/company/sahadotcollective/',
    },
    { label: 'UC Irvine feature', href: UCI_ARTICLE },
  ],
  experience: [
    {
      company: 'RollTrackApp',
      role: 'Co-founder & CTO',
      period: '2025 — Present',
      location: 'Irvine, California',
      summary:
        'Gym management SaaS for martial arts gyms. Technical lead and product manager, from the UC Irvine capstone to a company.',
      highlights: [
        'Designed and shipped attendance tracking, payment management, student records, gamification, and retention analytics.',
        'Led the AWS → DigitalOcean migration without customer-visible downtime; the database moved cleanly, while background workers, absolute-hostname callbacks, and cron windows were the real cutover work.',
        'Built the product surface as a Next.js client over a Django API and PostgreSQL database.',
      ],
      technologies: [
        'Next.js',
        'React',
        'TypeScript',
        'Django',
        'Python',
        'PostgreSQL',
        'AWS',
        'DigitalOcean',
      ],
      href: 'https://rolltrackapp.com',
    },
    {
      company: 'SAHA Collective',
      role: 'Freelance full-stack developer',
      period: 'Client engagement',
      summary:
        'Provider platform, scheduling, and telehealth video for a holistic-wellness marketplace founded by Alenka Kyslik.',
      highlights: [
        'Built the Provider Portal with Stripe Connect onboarding and payment flows, embedded into SAHA’s existing WordPress site.',
        'Forked an open-source scheduler, cut it down to the marketplace’s one-tenant surface, built the integration SAHA needed, and self-hosted it on a single DigitalOcean droplet — replacing a plan that carried a 100-user minimum at roughly $4,000 every month.',
        'Deployed and reskinned a self-hosted LiveKit stack (SAHA Meet) for HIPAA-appropriate telehealth video without per-seat hosted API fees.',
      ],
      technologies: [
        'Stripe Connect',
        'WordPress',
        'LiveKit',
        'WebRTC',
        'DigitalOcean',
      ],
    },
    {
      company: 'Independent projects',
      role: 'Full-stack developer',
      period: 'Ongoing',
      summary:
        'This portfolio is a production example of the delivery style: static-first Astro, server-rendered content, budgeted client JavaScript, and a Three.js ambient layer.',
      highlights: [
        'Static-first Astro site with MDX case studies, a Ghost-shaped content facade, and no client fetch for article content.',
        'Vendored Three.js wormhole intro with reduced-motion, no-WebGL, and no-JS fallbacks.',
        'Design-token parity, contrast, primitive, paint, audio, SEO, and claim-ledger checks run in CI.',
      ],
      technologies: ['Astro', 'TypeScript', 'Tailwind CSS', 'Three.js'],
    },
  ],
  education: [
    {
      institution: 'University of California, Irvine',
      degree: 'B.S. Informatics',
      period: '2025',
      detail:
        'First-generation student. Focus: organizations and information technology. 2025 ICS Project Expo capstone became RollTrackApp.',
      href: 'https://uci.edu',
    },
  ],
  certifications: [
    {
      name: 'monday Admin Certification',
      issuer: 'monday.com',
      date: '2026',
      note:
        'Proctored Admin Certification exam, awarded as a Diploma. Displayed as “monday Admin Certified.”',
    },
  ],
  skills: [
    {
      label: 'Languages',
      items: ['TypeScript', 'Python'],
    },
    {
      label: 'Frontend',
      items: ['Next.js', 'React', 'Astro', 'Tailwind CSS', 'Three.js'],
    },
    {
      label: 'Backend & data',
      items: ['Django', 'PostgreSQL', 'Stripe Connect', 'LiveKit', 'WebRTC'],
    },
    {
      label: 'Infrastructure & delivery',
      items: [
        'AWS',
        'DigitalOcean',
        'Self-hosted Linux',
        'Core Web Vitals',
        'SEO',
      ],
    },
    {
      label: 'Product',
      items: [
        'Full-stack product engineering',
        'Payment flows',
        'Retention analytics',
        'Technical leadership',
      ],
    },
  ],
  selectedWork: [
    {
      title: 'RollTrackApp — gym management SaaS',
      href: '/work/rolltrackapp',
      summary:
        'Attendance, payments, gamification, and retention analytics; the AWS → DigitalOcean migration.',
    },
    {
      title: 'SAHA Collective — marketplace, scheduler, telehealth',
      href: '/work/saha-collective',
      summary:
        'Stripe Connect provider portal, a self-hosted scheduler, and SAHA Meet on LiveKit.',
    },
  ],
  updated: '2026-11-14',
};
