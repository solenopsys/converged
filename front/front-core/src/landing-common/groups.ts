export type GroupDef = { id: string; title: string; iconName: string };

export const GROUPS: GroupDef[] = [
  { id: 'ai', title: 'AI', iconName: 'IconBrain' },
  { id: 'sales', title: 'Sales', iconName: 'IconBriefcase' },
  { id: 'business', title: 'Business', iconName: 'IconBriefcase' },
  { id: 'geo', title: 'Geo', iconName: 'IconGlobe' },
  { id: 'marketing', title: 'Marketing', iconName: 'IconTarget' },
  { id: 'workflows', title: 'Workflows', iconName: 'IconGitBranch' },
  { id: 'analytics', title: 'Analytics', iconName: 'IconChartBar' },
  { id: 'data', title: 'Data', iconName: 'IconDatabase' },
  { id: 'content', title: 'Content', iconName: 'IconFileText' },
  { id: 'social', title: 'Social', iconName: 'IconMessages' },
];
