import React from 'react';

// A broken game view must leave the lobby/account controls usable.
export default class GameBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return <div className="notice" role="alert">游戏界面暂时无法显示，可以刷新重试或返回大厅。<button className="secondary" disabled={this.props.disabled} onClick={this.props.onLeave}>离开房间</button></div>;
  }
}
