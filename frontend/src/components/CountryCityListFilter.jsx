import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, getCitiesByCountry } from "../constants/geo.js";
import list from "./FilterListMenu.module.css";
import styles from "./CountryCityListFilter.module.css";

const CountryCityListFilter = ({ country, city, onCountryChange, onCityChange }) => {
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const countryRef = useRef(null);
  const cityRef = useRef(null);

  const cities = useMemo(() => getCitiesByCountry(country), [country]);

  useEffect(() => {
    const handler = (e) => {
      if (countryRef.current && !countryRef.current.contains(e.target)) setCountryOpen(false);
      if (cityRef.current && !cityRef.current.contains(e.target)) setCityOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const countryLabel = country === "all" ? "Все страны" : country;
  const cityLabel = city === "all" ? "Все города" : city;

  return (
    <div className={styles.root}>
      <span className={styles.fieldLabel}>Страна</span>
      <div className={styles.dropdown} ref={countryRef}>
        <button
          type="button"
          className={styles.control}
          onClick={() => setCountryOpen((v) => !v)}
        >
          <span className={styles.controlText}>{countryLabel}</span>
          <span className={styles.arrow}>&#9662;</span>
        </button>
        {countryOpen && (
          <div className={list.menu} role="listbox">
            <button
              type="button"
              className={`${list.menuItem} ${country === "all" ? list.menuItemSelected : ""}`}
              onClick={() => {
                onCountryChange("all");
                setCountryOpen(false);
              }}
            >
              Все страны
            </button>
            {COUNTRIES.map((name) => (
              <button
                key={name}
                type="button"
                className={`${list.menuItem} ${country === name ? list.menuItemSelected : ""}`}
                onClick={() => {
                  onCountryChange(name);
                  setCountryOpen(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className={styles.fieldLabel}>Город</span>
      <div className={styles.dropdown} ref={cityRef}>
        <button
          type="button"
          className={`${styles.control} ${country === "all" ? styles.controlDisabled : ""}`}
          disabled={country === "all"}
          onClick={() => {
            if (country !== "all") setCityOpen((v) => !v);
          }}
        >
          <span className={styles.controlText}>{country === "all" ? "Сначала выберите страну" : cityLabel}</span>
          <span className={styles.arrow}>&#9662;</span>
        </button>
        {cityOpen && country !== "all" && (
          <div className={list.menu} role="listbox">
            <button
              type="button"
              className={`${list.menuItem} ${city === "all" ? list.menuItemSelected : ""}`}
              onClick={() => {
                onCityChange("all");
                setCityOpen(false);
              }}
            >
              Все города
            </button>
            {cities.map((name) => (
              <button
                key={name}
                type="button"
                className={`${list.menuItem} ${city === name ? list.menuItemSelected : ""}`}
                onClick={() => {
                  onCityChange(name);
                  setCityOpen(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CountryCityListFilter;
