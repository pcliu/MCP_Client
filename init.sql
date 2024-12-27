-- 创建 book 表
CREATE TABLE book (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    published_date DATE,
    genre VARCHAR(100),
    price NUMERIC(10, 2)
);

-- 插入示例数据
INSERT INTO book (title, author, published_date, genre, price) VALUES
('The Great Gatsby', 'F. Scott Fitzgerald', '1925-04-10', 'Classic', 10.99),
('1984', 'George Orwell', '1949-06-08', 'Dystopian', 8.99),
('To Kill a Mockingbird', 'Harper Lee', '1960-07-11', 'Classic', 12.99),
('Pride and Prejudice', 'Jane Austen', '1813-01-28', 'Romance', 9.99),
('The Catcher in the Rye', 'J.D. Salinger', '1951-07-16', 'Classic', 10.49),
('The Hobbit', 'J.R.R. Tolkien', '1937-09-21', 'Fantasy', 14.99),
('Moby Dick', 'Herman Melville', '1851-10-18', 'Adventure', 11.99),
('War and Peace', 'Leo Tolstoy', '1869-01-01', 'Historical', 15.99),
('Crime and Punishment', 'Fyodor Dostoevsky', '1866-01-01', 'Crime', 13.49),
('The Alchemist', 'Paulo Coelho', '1988-01-01', 'Fiction', 9.49),
('The Lord of the Rings', 'J.R.R. Tolkien', '1954-07-29', 'Fantasy', 20.99),
('Harry Potter and the Sorcerer''s Stone', 'J.K. Rowling', '1997-06-26', 'Fantasy', 19.99);