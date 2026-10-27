
-- CRIAR BANCO

CREATE DATABASE IF NOT EXISTS angel_guardian
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_general_ci;

USE angel_guardian;


-- USUÁRIOS (users)

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    cpf VARCHAR(30),
    telefone VARCHAR(40),
    birthdate DATE NULL,
    avatar_url VARCHAR(255),
    bio VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB;


-- TIPOS DE ALERTA (alert_types)

CREATE TABLE IF NOT EXISTS alert_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20),
    icon VARCHAR(50)
) ENGINE=InnoDB;

-- ALERTAS (alerts)

CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    alert_type_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('active','resolved','hidden') DEFAULT 'active',
    is_urgent BOOLEAN DEFAULT FALSE,

    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    address VARCHAR(255),
    neighborhood VARCHAR(100),
    city VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (alert_type_id) REFERENCES alert_types(id),

    INDEX (created_at),
    INDEX (status),
    INDEX (latitude, longitude)
) ENGINE=InnoDB;


-- MÍDIA DO ALERTA (alert_media)

CREATE TABLE IF NOT EXISTS alert_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_id INT NOT NULL,
    media_type ENUM('image','video') DEFAULT 'image',
    media_url VARCHAR(255) NOT NULL,
    caption VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- COMENTÁRIOS (comments)

CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX (alert_id)
) ENGINE=InnoDB;

-- CURTIDAS (likes)

CREATE TABLE IF NOT EXISTS likes (
    user_id INT NOT NULL,
    alert_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, alert_id),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- COMPARTILHAMENTOS (shares)

CREATE TABLE IF NOT EXISTS shares (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- FAVORITOS (saved_alerts)

CREATE TABLE IF NOT EXISTS saved_alerts (
    user_id INT NOT NULL,
    alert_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, alert_id),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- NOTIFICAÇÕES (notifications)

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX (user_id, is_read)
) ENGINE=InnoDB;


-- DENÚNCIAS (reports)

CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    alert_id INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- DADOS INICIAIS


INSERT INTO alert_types (name, color, icon) VALUES
('Assalto', '#E53935', 'alert'),
('Furto', '#FBC02D', 'package'),
('Suspeito', '#FB8C00', 'user'),
('Emergência', '#D32F2F', 'warning')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO users (name, email, password_hash, cpf, telefone, avatar_url) VALUES
('Pedro Lima', 'pedro@email.com', '$2y$10$testehash123', '111.111.111-11', '(21) 98888-0000', 'https://i.pravatar.cc/150?img=12'),
('Ana Costa', 'ana@email.com', '$2y$10$testehash123', '222.222.222-22', '(21) 97777-0000', 'https://i.pravatar.cc/150?img=32')
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO alerts (user_id, alert_type_id, title, description, is_urgent, latitude, longitude, address, neighborhood, city)
VALUES
(1, 1, 'Assalto na Praça XV', 'Furtaram um carro na Praça XV! Foto do suspeito.', 1, -22.9035, -43.2096, 'Praça XV', 'Centro', 'Rio de Janeiro'),
(2, 3, 'Homem suspeito visto novamente', 'Homem suspeito visto novamente! Tomem cuidado!', 0, -22.9040, -43.2102, 'Rua Central', 'Centro', 'Rio de Janeiro')
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO comments (alert_id, user_id, content) VALUES
(1, 2, 'Obrigado por avisar!'),
(2, 1, 'Vi ele também!')
ON DUPLICATE KEY UPDATE content = VALUES(content);
