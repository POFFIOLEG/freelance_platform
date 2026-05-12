import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <div className="card auth-card" style={{ maxWidth: 520, margin: "2rem auto" }}>
            <h2>Не удалось отобразить страницу</h2>
            <p className="muted-text">
              Произошла ошибка интерфейса. Обновите страницу — при повторении откройте консоль браузера (F12).
            </p>
            <button className="primary-button" type="button" onClick={() => window.location.reload()}>
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
