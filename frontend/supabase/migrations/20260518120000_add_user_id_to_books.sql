-- Добавление поля user_id в таблицу books
ALTER TABLE books ADD COLUMN user_id uuid;

-- (Необязательно) Индекс для ускорения поиска по user_id
CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);