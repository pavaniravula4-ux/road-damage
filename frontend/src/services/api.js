import axios from "axios";

const instance = axios.create({
  baseURL: "http://localhost:5000", // backend server
});

export default instance;
