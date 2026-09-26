import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isMockApiEnabled } from "../constants/mockAuth";

/** Lets Playwright drive React Router without reloading mock auth state. */
export function E2eRouterBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMockApiEnabled()) return;

    window.__hackutaTestNavigate = (path) => {
      navigate(path);
    };

    return () => {
      delete window.__hackutaTestNavigate;
    };
  }, [navigate]);

  return null;
}
