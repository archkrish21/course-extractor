"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export interface Account {
  id: string;
  studentName: string;
  gradeLevel: number;
  graduationYear: number;
  role: string;
  isClaimed: boolean;
  subscriptionTier: string;
}

export interface AccountContextType {
  currentAccount: Account | null;
  accounts: Account[];
  switchAccount: (accountId: string) => void;
  loading: boolean;
  refetchAccounts: () => Promise<void>;
  userEmail: string | null;
  userRole: string | null;
}

const STORAGE_KEY = "saps_current_account_id";

const AccountContext = createContext<AccountContextType>({
  currentAccount: null,
  accounts: [],
  switchAccount: () => {},
  loading: true,
  refetchAccounts: async () => {},
  userEmail: null,
  userRole: null,
});

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/accounts");
      if (!res.ok) {
        setAccounts([]);
        return;
      }
      const data = await res.json();
      const list: Account[] = (data.accounts ?? data.data ?? data ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any) => ({
          id: a.id,
          studentName: a.student_name ?? a.studentName ?? "",
          gradeLevel: a.grade_level ?? a.gradeLevel ?? 0,
          graduationYear: a.graduation_year ?? a.graduationYear ?? 0,
          role: a.role ?? "",
          isClaimed: a.is_claimed ?? a.isClaimed ?? false,
          subscriptionTier: a.subscription_tier ?? a.subscriptionTier ?? "free",
        })
      );
      setAccounts(list);

      // Restore from localStorage or default to first account
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      const match = list.find((a) => a.id === stored);
      if (match) {
        setCurrentAccountId(match.id);
      } else if (list.length > 0) {
        setCurrentAccountId(list[0].id);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, list[0].id);
        }
      }
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    // Fetch logged-in user info
    fetch("/api/v1/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const u = data?.data ?? data;
        if (u) {
          setUserEmail(u.email ?? null);
          setUserRole(u.role ?? null);
        }
      })
      .catch(() => {});
  }, [fetchAccounts]);

  const switchAccount = useCallback(
    (accountId: string) => {
      const match = accounts.find((a) => a.id === accountId);
      if (match) {
        setCurrentAccountId(accountId);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, accountId);
        }
        // Reload the page so all data re-fetches for the new account
        window.location.reload();
      }
    },
    [accounts]
  );

  const currentAccount =
    accounts.find((a) => a.id === currentAccountId) ?? null;

  return (
    <AccountContext.Provider
      value={{
        currentAccount,
        accounts,
        switchAccount,
        loading,
        refetchAccounts: fetchAccounts,
        userEmail,
        userRole,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}

export { AccountContext };
