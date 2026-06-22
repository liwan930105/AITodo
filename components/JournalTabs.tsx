type JournalTab = {
  id: string;
  label: string;
};

type JournalTabsProps = {
  tabs: JournalTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
};

export default function JournalTabs({ tabs, activeTab, onChange }: JournalTabsProps) {
  return (
    <nav className="journal-tabs" aria-label="页面导航">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={["journal-tab", isActive ? "journal-tab-active" : ""].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
