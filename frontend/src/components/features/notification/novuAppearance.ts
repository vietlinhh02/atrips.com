export const novuAppearance = {
  variables: {
    colorBackground: 'var(--neutral-10)',
    colorForeground: 'var(--neutral-100)',
    colorPrimary: 'var(--primary-main)',
    colorSecondaryForeground: 'var(--neutral-60)',
    colorNeutral: 'var(--neutral-40)',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontFamily: '"Inter Tight", system-ui, sans-serif',
  },
  elements: {
    bellIcon: {
      color: 'var(--neutral-70)',
    },
    'bellIcon:hover': {
      color: 'var(--neutral-100)',
    },
    bellContainer: {
      borderRadius: '0.5rem',
      padding: '0.375rem',
    },
    popoverContent: {
      borderRadius: '0.75rem',
      border: '1px solid var(--neutral-30)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    },
    popoverHeader: {
      borderBottom: '1px solid var(--neutral-30)',
      padding: '0.875rem 1rem',
    },
    popoverTitle: {
      fontSize: '0px',
      color: 'transparent',
      overflow: 'hidden',
      backgroundImage: 'url(/images/logo-email.png)',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'contain',
      backgroundPosition: 'left center',
      width: '120px',
      height: '28px',
      display: 'block',
    },
    tabsList: {
      borderBottom: '1px solid var(--neutral-30)',
      gap: '0',
    },
    tabsTrigger: {
      fontSize: '0.8125rem',
      fontWeight: '500',
      color: 'var(--neutral-60)',
      padding: '0.5rem 0.875rem',
      borderRadius: '0',
    },
    'tabsTrigger[data-state="active"]': {
      color: 'var(--primary-main)',
      borderBottom: '2px solid var(--primary-main)',
    },
    notification: {
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--neutral-30)',
      backgroundColor: 'var(--neutral-10)',
      transition: 'background-color 0.15s ease',
    },
    'notification:hover': {
      backgroundColor: 'var(--neutral-20)',
    },
    notificationDot: {
      backgroundColor: 'var(--primary-main)',
    },
    'notification[data-unread="true"]': {
      backgroundColor: 'var(--primary-surface)',
      borderLeft: '3px solid var(--primary-main)',
    },
    notificationSubject: {
      fontSize: '0.8125rem',
      fontWeight: '600',
      color: 'var(--neutral-100)',
    },
    notificationBody: {
      fontSize: '0.75rem',
      color: 'var(--neutral-60)',
      lineHeight: '1.5',
    },
    notificationDate: {
      fontSize: '0.6875rem',
      color: 'var(--neutral-50)',
    },
    notificationPrimaryAction: {
      backgroundColor: 'var(--primary-main)',
      color: '#ffffff',
      borderRadius: '0.375rem',
      fontSize: '0.75rem',
      fontWeight: '500',
      padding: '0.375rem 0.75rem',
    },
    'notificationPrimaryAction:hover': {
      backgroundColor: 'var(--primary-hover)',
    },
    channelSwitchContainer: {
      borderBottom: '1px solid var(--neutral-30)',
    },
  },
};
