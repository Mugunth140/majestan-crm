-- Personal settings that follow a user across devices, such as which columns
-- each list table shows. One JSON value per user and key.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INT NOT NULL,
  pref_key VARCHAR(191) NOT NULL,
  value JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, pref_key),
  CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
