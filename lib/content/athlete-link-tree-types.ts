export type AthleteLinkTreeLink = {
  id: string;
  name: string;
  publicLabel: string | null;
  internalDescription: string | null;
  isSection: boolean;
  description: string | null;
  linkLogoUrl: string | null;
  emoji: string | null;
  url: string | null;
  sortOrder: number;
};

export type AthleteLinkTreeDetail = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  internalDescription: string | null;
  publicLabel: string | null;
  publicDescription: string | null;
  isRoot: boolean;
  links: AthleteLinkTreeLink[];
};
