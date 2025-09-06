// User model - optimized version
class User {
  constructor(socketId, userName) {
    this.socketId = socketId;
    this.userName = userName;
    this.currentRoom = null;
    this._isTyping = false;
    this._isInCall = false;
    this._cameraOn = false;
    this._micOn = false;
    this.connectedAt = new Date();
  }

  // ----- Room Management -----
  joinRoom(roomId) {
    this.currentRoom = roomId;
    return this; // allow chaining
  }

  leaveRoom() {
    const leftRoom = this.currentRoom;
    this.currentRoom = null;
    return leftRoom;
  }

  // ----- Typing Status -----
  set typing(status) {
    this._isTyping = Boolean(status);
  }

  get typing() {
    return this._isTyping;
  }

  // ----- Call Management -----
  joinCall() {
    this._isInCall = true;
    return this;
  }

  leaveCall() {
    this._isInCall = false;
    this._cameraOn = false;
    this._micOn = false;
    return this;
  }

  toggleCamera() {
    this._cameraOn = !this._cameraOn;
    return this._cameraOn;
  }

  toggleMicrophone() {
    this._micOn = !this._micOn;
    return this._micOn;
  }

  // ----- User Info -----
  get info() {
    return {
      socketId: this.socketId,
      userName: this.userName,
      currentRoom: this.currentRoom,
      isTyping: this._isTyping,
      isInCall: this._isInCall,
      cameraOn: this._cameraOn,
      micOn: this._micOn,
      connectedAt: this.connectedAt
    };
  }

  updateName(newName) {
    this.userName = newName.trim();
    return this.userName;
  }
}

export default User;
