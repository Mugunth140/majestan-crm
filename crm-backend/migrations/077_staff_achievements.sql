-- Achievements a person has already celebrated on their dashboard, so the
-- confetti plays once per achievement and period on every device.
CREATE TABLE IF NOT EXISTS staff_achievements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  achievement_key VARCHAR(80) NOT NULL,
  period VARCHAR(20) NOT NULL,
  seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_achievements (user_id, achievement_key, period),
  CONSTRAINT fk_staff_achievements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
