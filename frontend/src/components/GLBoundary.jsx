import { Component } from "react";

/** If a WebGL scene fails to start (no GPU, lost context, blocked), show the 2D version instead of a blank box. */
export default class GLBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
