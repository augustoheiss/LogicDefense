/* =================================================================
   CV Data Types — Extended JSON Resume Standard
   ================================================================= */

export interface CVLocation {
  address?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  region?: string;
}

export interface CVProfile {
  network: string;
  username: string;
  url?: string;
}

export interface CVBasics {
  name: string;
  label?: string;
  image?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: CVLocation;
  profiles?: CVProfile[];
}

export interface CVWork {
  name: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface CVVolunteer {
  organization: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface CVEducation {
  institution: string;
  url?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
  courses?: string[];
}

export interface CVAward {
  title: string;
  date?: string;
  awarder?: string;
  summary?: string;
}

export interface CVCertificate {
  name: string;
  date?: string;
  issuer?: string;
  url?: string;
}

export interface CVPublication {
  name: string;
  publisher?: string;
  releaseDate?: string;
  url?: string;
  summary?: string;
}

export interface CVSkill {
  name: string;
  level?: string;
  keywords?: string[];
}

export interface CVLanguage {
  language: string;
  fluency?: string;
}

export interface CVInterest {
  name: string;
  keywords?: string[];
}

export interface CVReference {
  name: string;
  reference?: string;
}

export interface CVProject {
  name: string;
  description?: string;
  highlights?: string[];
  keywords?: string[];
  startDate?: string;
  endDate?: string;
  url?: string;
  roles?: string[];
  entity?: string;
  type?: string;
}

export interface CVData {
  basics: CVBasics;
  work?: CVWork[];
  volunteer?: CVVolunteer[];
  education?: CVEducation[];
  awards?: CVAward[];
  certificates?: CVCertificate[];
  publications?: CVPublication[];
  skills?: CVSkill[];
  languages?: CVLanguage[];
  interests?: CVInterest[];
  references?: CVReference[];
  projects?: CVProject[];
}

export type TextVariant = 'professional' | 'historian' | 'didactic' | 'alien';
export type ThemeVariant = 'executive' | 'historian' | 'didactic' | 'alien';

export interface SectionLabels {
  work: string;
  education: string;
  skills: string;
  projects: string;
  languages: string;
  interests: string;
  volunteer: string;
  publications: string;
  certificates: string;
  awards: string;
  summary: string;
}

export const TEXT_LABELS: Record<TextVariant, SectionLabels> = {
  professional: {
    work: 'Work Experience',
    education: 'Education',
    skills: 'Technical Skills',
    projects: 'Projects',
    languages: 'Languages',
    interests: 'Interests',
    volunteer: 'Volunteer Work',
    publications: 'Publications',
    certificates: 'Certifications',
    awards: 'Awards & Recognition',
    summary: 'Professional Summary',
  },
  historian: {
    work: 'Career Chapters',
    education: 'Academic Journey',
    skills: 'Mastered Crafts',
    projects: 'Works & Endeavors',
    languages: 'Tongues Spoken',
    interests: 'Pursuits',
    volunteer: 'Service to Community',
    publications: 'Writings & Broadcasts',
    certificates: 'Earned Distinctions',
    awards: 'Honours Bestowed',
    summary: 'The Story So Far',
  },
  didactic: {
    work: 'What I Have Built',
    education: 'What I Have Studied',
    skills: 'What I Can Do',
    projects: 'What I Have Created',
    languages: 'How I Communicate',
    interests: 'What Drives Me',
    volunteer: 'How I Give Back',
    publications: 'What I Have Shared',
    certificates: 'What I Have Proved',
    awards: 'What I Have Earned',
    summary: 'Who I Am',
  },
  alien: {
    work: '⚡ Mission Logs',
    education: '🧬 Knowledge Downloads',
    skills: '🔧 Installed Modules',
    projects: '🚀 Deployed Systems',
    languages: '📡 Communication Protocols',
    interests: '🌀 Processing Patterns',
    volunteer: '🤝 Alliance Operations',
    publications: '📻 Transmissions',
    certificates: '🏅 Achievement Unlocked',
    awards: '🏆 XP Milestones',
    summary: '🤖 Unit Profile',
  },
};
