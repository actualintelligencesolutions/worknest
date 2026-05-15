import { NewDashSectionPage } from './SectionPage';
import { SetupWorkspacePage } from './SetupWorkspacePage';

export function NewDashSetupWorkspacePage() {
  return <SetupWorkspacePage />;
}

export function NewDashOfficesPage() {
  return (
    <NewDashSectionPage
      descriptionKey="pages.newDash.sections.offices.description"
      titleKey="pages.newDash.sections.offices.title"
    />
  );
}

export function NewDashTeamPage() {
  return (
    <NewDashSectionPage
      descriptionKey="pages.newDash.sections.team.description"
      titleKey="pages.newDash.sections.team.title"
    />
  );
}

export function NewDashReportsPage() {
  return (
    <NewDashSectionPage
      descriptionKey="pages.newDash.sections.reports.description"
      titleKey="pages.newDash.sections.reports.title"
    />
  );
}

export function NewDashProfilePage() {
  return (
    <NewDashSectionPage
      descriptionKey="pages.newDash.sections.profile.description"
      titleKey="pages.newDash.sections.profile.title"
    />
  );
}

export function NewDashSettingsPage() {
  return (
    <NewDashSectionPage
      descriptionKey="pages.newDash.sections.settings.description"
      titleKey="pages.newDash.sections.settings.title"
    />
  );
}

export function NewDashHelpPage() {
  return (
    <NewDashSectionPage
      descriptionKey="pages.newDash.sections.help.description"
      titleKey="pages.newDash.sections.help.title"
    />
  );
}
