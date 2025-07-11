from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import sqlite3
import os
import time
from datetime import datetime
from flask_cors import CORS
import random
import smtplib
import secrets
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Change this in production!

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')  # Replace with your email
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')  # Replace with your email password or app password
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER')

# Dictionary to store OTPs (in production, use Redis or database)
otp_storage = {}

# Configure upload folder
UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Create upload folder if it doesn't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

try:
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login('vakyamanch@gmail.com', 'ibad jfml iecv tzap')  # Replace with your email and password
    print("SMTP connection successful!")
    server.quit()
except Exception as e:
    print(f"SMTP error: {e}")

# Verify write permissions
try:
    test_file = os.path.join(UPLOAD_FOLDER, 'test_permissions.txt')
    with open(test_file, 'w') as f:
        f.write('test')
    os.remove(test_file)
except Exception as e:
    print(f"CRITICAL: Cannot write to upload directory: {str(e)}")
    print(f"Please check permissions for: {UPLOAD_FOLDER}")

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def generate_otp():
    return str(random.randint(100000, 999999))

def generate_secure_otp(length=6):
    """Generate a secure random OTP"""
    return ''.join(secrets.choice(string.digits) for _ in range(length))

def send_otp_email(email, otp):
    try:
        msg = MIMEText(f"""
        Your OTP for VākyaManch registration is: {otp}
        
        This OTP is valid for 10 minutes.
        
        If you didn't request this, please ignore this email.
        """)
        msg['Subject'] = 'VākyaManch Registration OTP'
        msg['From'] = app.config['MAIL_DEFAULT_SENDER']
        msg['To'] = email

        with smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT']) as server:
            server.starttls()
            server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
            server.send_message(msg)
        return True
    except smtplib.SMTPException as e:
        print(f"SMTP Error sending to {email}: {str(e)}")
        return False
    except Exception as e:
        print(f"General Error sending to {email}: {str(e)}")
        return False

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_ist_time():
    return datetime.now(pytz.timezone('Asia/Kolkata'))


@app.route('/favicon.ico')
def favicon():
    return redirect(url_for('static', filename='favicon.ico'))


# Initialize database
def init_db():
    try:
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        
        # Enable foreign key constraints
        cursor.execute("PRAGMA foreign_keys = ON")
        
        # Create users table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
        ''')
        
        # Create posts table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        ''')

        # Create likes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (post_id) REFERENCES posts (id),
            UNIQUE(user_id, post_id)  
        )
        ''')

         # Create comments table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (post_id) REFERENCES posts (id)
        )
        ''')

        cursor.execute("PRAGMA table_info(posts)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'image' not in columns:
            cursor.execute("ALTER TABLE posts ADD COLUMN image TEXT")
        
        conn.commit()
        print("Database initialized successfully!")
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise  # Re-raise the exception to fail loudly
    finally:
        if conn:
            conn.close()

# Call init_db when the app starts
init_db()

# Database connection helper
def get_db():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def delete_post_image(image_filename):
    if image_filename:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], image_filename))
        except OSError:
            pass  # File doesn't exist or couldn't be deleted

@app.template_filter('format_date')
def format_date(value):
    if isinstance(value, str):
        value = datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
    return value.strftime('%b %d, %Y at %I:%M %p')

# Add these new routes to app.py
@app.route('/send_otp', methods=['POST'])
def send_otp():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        email = data.get('email')
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        # Generate secure OTP
        otp = generate_secure_otp()
        otp_storage[email] = {
            'otp': otp,
            'timestamp': time.time()
        }
        
        # Send email
        if not send_otp_email(email, otp):
            return jsonify({'error': 'Failed to send OTP email'}), 500
            
        return jsonify({
            'success': True, 
            'message': 'OTP sent successfully',
            'otp': otp  # For debugging only - remove in production
        })
        
    except Exception as e:
        print(f"Error in send_otp: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)  # For debugging only - remove in production
        }), 500

@app.route('/test_smtp')
def test_smtp():
    try:
        with smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT']) as server:
            server.starttls()
            server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
            return "SMTP connection successful!"
    except smtplib.SMTPAuthenticationError as e:
        return f"SMTP Authentication failed: {e}"
    except Exception as e:
        return f"SMTP Error: {e}"

@app.route('/verify_otp', methods=['POST'])
def verify_otp():
    email = request.json.get('email')
    otp = request.json.get('otp')
    
    if not email or not otp:
        return jsonify({'error': 'Email and OTP are required'}), 400
    
    stored_data = otp_storage.get(email)
    
    if not stored_data:
        return jsonify({'error': 'OTP not found or expired'}), 404
    
    # Check if OTP is expired (10 minutes)
    if time.time() - stored_data['timestamp'] > 600:
        del otp_storage[email]  # Clean up expired OTP
        return jsonify({'error': 'OTP expired'}), 400
    
    if stored_data['otp'] == otp:
        # Mark email as verified
        otp_storage[email]['verified'] = True
        return jsonify({'success': True, 'message': 'OTP verified successfully'})
    else:
        return jsonify({'error': 'Invalid OTP'}), 400

# Edit Post - Form
@app.route('/edit_post/<int:post_id>')
def edit_post_form(post_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM posts WHERE id = ? AND user_id = ?', (post_id, session['user_id']))
    post = cursor.fetchone()
    conn.close()
    
    if not post:
        flash('Post not found or you do not have permission to edit it', 'error')
        return redirect(url_for('dashboard'))
    
    return render_template('edit_post.html', post=dict(post))

# Edit Post - Submission
@app.route('/edit_post/<int:post_id>', methods=['POST'])
def edit_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    title = request.form.get('title')
    content = request.form.get('content')
    image = request.files.get('image')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Verify post belongs to user
        cursor.execute('SELECT * FROM posts WHERE id = ? AND user_id = ?', (post_id, session['user_id']))
        post = cursor.fetchone()
        
        if not post:
            return jsonify({'error': 'Post not found or permission denied'}), 403
        
        # Handle image update
        image_filename = post['image']
        if image:
            # Delete old image if exists
            if image_filename:
                delete_post_image(image_filename)
            # Save new image
            image_filename = save_uploaded_file(image)
        
        # Update post
        cursor.execute('''
            UPDATE posts 
            SET title = ?, content = ?, image = ?
            WHERE id = ? AND user_id = ?
        ''', (title, content, image_filename, post_id, session['user_id']))
        
        conn.commit()
        return jsonify({'success': True, 'message': 'Post updated successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

# Like a post
@app.route('/like_post/<int:post_id>', methods=['POST'])
def like_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401
    
    user_id = session['user_id']
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Verify post exists and doesn't belong to current user
        cursor.execute('SELECT user_id FROM posts WHERE id = ?', (post_id,))
        post = cursor.fetchone()
        
        if not post:
            return jsonify({'error': 'Post not found'}), 404

        if post['user_id'] == user_id:
            return jsonify({
                'error': 'You cannot like your own post',
                'code': 'SELF_LIKE_NOT_ALLOWED'
            }), 400
        
        # Check if already liked (this is the critical fix)
        cursor.execute('SELECT id FROM likes WHERE user_id = ? AND post_id = ?', (user_id, post_id))
        existing_like = cursor.fetchone()
        
        if existing_like:
            # Unlike if already liked
            cursor.execute('DELETE FROM likes WHERE id = ?', (existing_like['id'],))
            action = 'unliked'
        else:
            # Like if not already liked
            try:
                cursor.execute('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', (user_id, post_id))
                action = 'liked'
            except sqlite3.IntegrityError:
                # Handle rare race condition
                conn.rollback()
                cursor.execute('SELECT id FROM likes WHERE user_id = ? AND post_id = ?', (user_id, post_id))
                if cursor.fetchone():
                    cursor.execute('DELETE FROM likes WHERE user_id = ? AND post_id = ?', (user_id, post_id))
                    action = 'unliked'
        
        conn.commit()
        
        # Get updated like count
        cursor.execute('SELECT COUNT(*) as like_count FROM likes WHERE post_id = ?', (post_id,))
        like_count = cursor.fetchone()['like_count']
        
        return jsonify({
            'success': True,
            'action': action,
            'like_count': like_count
        })
        
    except Exception as e:
        print(f"Error in like_post: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

# Add comment
@app.route('/comment_post/<int:post_id>', methods=['POST'])
def comment_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Login required'}), 401
    
    try:
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Comment content is required'}), 400
        
        content = data['content'].strip()
        user_id = session['user_id']
        
        if not content:
            return jsonify({'error': 'Comment cannot be empty'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verify post exists and doesn't belong to current user
        cursor.execute('SELECT user_id FROM posts WHERE id = ?', (post_id,))
        post = cursor.fetchone()
        
        if not post:
            return jsonify({'error': 'Post not found'}), 404
            
        
        # Check for duplicate comment (same user, same post, same content)
        cursor.execute('''
            SELECT id FROM comments 
            WHERE user_id = ? AND post_id = ? AND content = ?
            LIMIT 1
        ''', (user_id, post_id, content))
        if cursor.fetchone():
            return jsonify({
                'error': 'Duplicate comment detected',
                'code': 'DUPLICATE_COMMENT'
            }), 400
        
        # Add comment
        cursor.execute('''
            INSERT INTO comments (user_id, post_id, content)
            VALUES (?, ?, ?)
        ''', (user_id, post_id, content))
        
        conn.commit()
        
        # Get the new comment with username
        cursor.execute('''
            SELECT comments.*, users.username 
            FROM comments 
            JOIN users ON comments.user_id = users.id 
            WHERE comments.id = ?
        ''', (cursor.lastrowid,))
        comment = cursor.fetchone()

        # Also return updated comment count
        cursor.execute('SELECT COUNT(*) as comment_count FROM comments WHERE post_id = ?', (post_id,))
        comment_count = cursor.fetchone()['comment_count']
        
        return jsonify({
            **dict(comment),
            'comment_count': comment_count
        })
        
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/get_comments/<int:post_id>')
def get_comments(post_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get comments with usernames and post author info
        cursor.execute('''
            SELECT 
                comments.*, 
                users.username,
                posts.user_id as post_author_id
            FROM comments 
            JOIN users ON comments.user_id = users.id
            JOIN posts ON comments.post_id = posts.id
            WHERE comments.post_id = ?
            ORDER BY comments.created_at ASC
        ''', (post_id,))
        
        comments = [dict(comment) for comment in cursor.fetchall()]
        return jsonify(comments)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()


# Delete Post
@app.route('/delete_post/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Verify post belongs to user
        cursor.execute('SELECT image FROM posts WHERE id = ? AND user_id = ?', (post_id, session['user_id']))
        post = cursor.fetchone()
        
        if not post:
            return jsonify({'error': 'Post not found or permission denied'}), 403
        
        # Delete associated image
        if post['image']:
            delete_post_image(post['image'])
        
        # Delete post
        cursor.execute('DELETE FROM posts WHERE id = ?', (post_id,))
        conn.commit()
        return jsonify({'success': True, 'message': 'Post deleted successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

# User registration
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        # Handle both JSON and form data
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        otp = data.get('otp')
        
        # Check if email is verified
        stored_data = otp_storage.get(email)
        if not stored_data or not stored_data.get('verified'):
            if request.is_json:
                return jsonify({'error': 'Email not verified. Please complete OTP verification.'}), 400
            flash('Email not verified. Please complete OTP verification.', 'error')
            return redirect(url_for('register'))

        # Validation
        if not username or not email or not password:
            if request.is_json:
                return jsonify({'error': 'All fields are required!'}), 400
            flash('All fields are required!', 'error')
            return redirect(url_for('register'))
        
        if password != confirm_password:
            if request.is_json:
                return jsonify({'error': 'Passwords do not match!'}), 400
            flash('Passwords do not match!', 'error')
            return redirect(url_for('register'))
        
        if len(password) < 6:
            if request.is_json:
                return jsonify({'error': 'Password must be at least 6 characters!'}), 400
            flash('Password must be at least 6 characters!', 'error')
            return redirect(url_for('register'))
        
        hashed_password = generate_password_hash(password)
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                (username, email, hashed_password))
            conn.commit()
            
            if request.is_json:
                return jsonify({'success': 'Registration successful!'})
            
            flash('Registration successful! Please login.', 'success')
            return redirect(url_for('login'))
        except sqlite3.IntegrityError as e:
            error_msg = 'Username or email already exists!'
            if request.is_json:
                return jsonify({'error': error_msg}), 400
            flash(error_msg, 'error')
            return redirect(url_for('register'))
        except Exception as e:
            error_msg = f'Registration failed: {str(e)}'
            if request.is_json:
                return jsonify({'error': error_msg}), 500
            flash(error_msg, 'error')
            return redirect(url_for('register'))
        finally:
            if conn:
                conn.close()
    
    return render_template('register.html')

# User login
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # Basic validation
        if not username or not password:
            return jsonify({
                'error': 'Both username and password are required!',
                'field': 'both'
            }), 400
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            # Get user by username
            cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
            user = cursor.fetchone()
            
            if not user:
                return jsonify({
                    'error': 'Username not found!',
                    'field': 'username'
                }), 404
            
            if not check_password_hash(user['password'], password):
                return jsonify({
                    'error': 'Incorrect password!',
                    'field': 'password'
                }), 401
            
            # Successful login
            session['user_id'] = user['id']
            session['username'] = user['username']
            return jsonify({
                'success': 'Login successful!',
                'redirect': url_for('dashboard')
            })
            
        except sqlite3.Error as e:
            return jsonify({
                'error': f'Database error: {str(e)}'
            }), 500
        finally:
            if conn:
                conn.close()
    
    # GET request - render the template
    return render_template('login.html')
    

# User logout
@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('index'))

# Dashboard
@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        flash('Please login to access the dashboard.', 'error')
        return redirect(url_for('login'))
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Get user's posts with counts
        cursor.execute('''
            SELECT 
                posts.*, 
                users.username,
                (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comment_count,
                posts.image IS NOT NULL AND 
                EXISTS(SELECT 1 FROM posts p WHERE p.id = posts.id AND p.image IS NOT NULL) as image_exists
            FROM posts 
            JOIN users ON posts.user_id = users.id
            WHERE posts.user_id = ?
            ORDER BY posts.created_at DESC
        ''', (session['user_id'],))
        
        posts = [dict(post) for post in cursor.fetchall()]
        
        # Get comments for each post
        for post in posts:
            cursor.execute('''
                SELECT c.*, u.username 
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.post_id = ?
                ORDER BY c.created_at DESC
            ''', (post['id'],))
            post['comments'] = [dict(comment) for comment in cursor.fetchall()]
        
        return render_template('dashboard.html', posts=posts)
    finally:
        if conn:
            conn.close()

# Create post
@app.route('/create_post', methods=['POST'])
def create_post():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    title = request.form.get('title')
    content = request.form.get('content')
    image = request.files.get('image')
    
    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400
    
    image_filename = None
    if image:
        image_filename = save_uploaded_file(image)
        if not image_filename:
            return jsonify({'error': 'Invalid image file'}), 400
    

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO posts (title, content, user_id, image) VALUES (?, ?, ?, ?)',
            (title, content, session['user_id'], image_filename))
        conn.commit()
        
        post_id = cursor.lastrowid
        cursor.execute('SELECT * FROM posts WHERE id = ?', (post_id,))
        post = cursor.fetchone()
        
        return jsonify({
            'id': post['id'],
            'title': post['title'],
            'content': post['content'],
            'image': post['image'],
            'created_at': post['created_at']
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/post/<int:post_id>')
def view_post(post_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get the post with author info
        cursor.execute('''
            SELECT posts.*, users.username 
            FROM posts 
            JOIN users ON posts.user_id = users.id 
            WHERE posts.id = ?
        ''', (post_id,))
        post = cursor.fetchone()
        
        if not post:
            flash('Post not found', 'error')
            return redirect(url_for('feed'))
        
        # Get comments for this post
        cursor.execute('''
            SELECT comments.*, users.username 
            FROM comments 
            JOIN users ON comments.user_id = users.id 
            WHERE post_id = ?
            ORDER BY comments.created_at DESC
        ''', (post_id,))
        comments = cursor.fetchall()
        
        # Get like count
        cursor.execute('SELECT COUNT(*) as like_count FROM likes WHERE post_id = ?', (post_id,))
        like_count = cursor.fetchone()['like_count']
        
        # Check if current user has liked this post
        user_liked = False
        if 'user_id' in session:
            cursor.execute('SELECT id FROM likes WHERE user_id = ? AND post_id = ?', 
                         (session['user_id'], post_id))
            user_liked = cursor.fetchone() is not None
        
        return render_template('view_post.html', 
                             post=dict(post),
                             comments=[dict(c) for c in comments],
                             like_count=like_count,
                             user_liked=user_liked,
                             current_user_id=session.get('user_id'))
        
    except Exception as e:
        flash(f'Error loading post: {str(e)}', 'error')
        return redirect(url_for('feed'))
    finally:
        if conn:
            conn.close()

@app.route('/delete_comment/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Verify comment exists and user has permission
        cursor.execute('''
            SELECT comments.id, comments.user_id, posts.user_id as post_author_id
            FROM comments
            JOIN posts ON comments.post_id = posts.id
            WHERE comments.id = ?
        ''', (comment_id,))
        comment = cursor.fetchone()
        
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        
        # Check if current user is comment author OR post author
        if session['user_id'] not in (comment['user_id'], comment['post_author_id']):
            return jsonify({'error': 'Permission denied'}), 403
        
        # Delete the comment
        cursor.execute('DELETE FROM comments WHERE id = ?', (comment_id,))
        conn.commit()
        
        return jsonify({'success': True, 'message': 'Comment deleted'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()


# Get all posts
@app.route('/posts')
def get_posts():
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get all posts with like counts and comment counts
        cursor.execute('''
            SELECT 
                posts.*, 
                users.username,
                (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comment_count,
                EXISTS(SELECT 1 FROM likes WHERE post_id = posts.id AND user_id = ?) as user_liked
            FROM posts 
            JOIN users ON posts.user_id = users.id 
            ORDER BY posts.created_at DESC
        ''', (session.get('user_id', -1),))  # Use -1 if no user is logged in
        
        posts = []
        for row in cursor.fetchall():
            post = dict(row)
            post['created_at'] = row['created_at'].isoformat() if 'created_at' in row else None
            posts.append(post)
            
        return jsonify(posts)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/debug-uploads')
def debug_uploads():
    if 'user_id' not in session:
        return "Unauthorized", 401
    
    uploads = []
    try:
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            uploads.append({
                'filename': filename,
                'exists': os.path.exists(filepath),
                'size': os.path.getsize(filepath) if os.path.exists(filepath) else 0
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    return render_template('debug_uploads.html', uploads=uploads)

@app.route('/debug-templates')
def debug_templates():
    import os
    template_path = os.path.join(app.root_path, 'templates')
    return {
        'template_path': template_path,
        'files': os.listdir(template_path) if os.path.exists(template_path) else 'Directory not found'
    }

@app.route('/db-status')
def db_status():
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Check tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        return jsonify({
            'status': 'ok',
            'tables': tables,
            'users_count': cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0] if 'users' in tables else 0
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500



def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_uploaded_file(file):
    if file and allowed_file(file.filename):
        # Get the file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        # Create a safe filename with timestamp (replace spaces and special chars)
        safe_filename = f"{int(time.time())}_{secure_filename(file.filename.replace(' ', '_'))}"
        # Ensure the extension is preserved
        safe_filename = os.path.splitext(safe_filename)[0] + file_ext
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], safe_filename)
        file.save(filepath)
        return safe_filename
    return None

@app.route('/feed')
def feed():
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get posts with like counts and comment counts
        cursor.execute('''
            SELECT 
                posts.*, 
                users.username,
                (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comment_count,
                EXISTS(SELECT 1 FROM likes WHERE post_id = posts.id AND user_id = ?) as user_liked,
                posts.image IS NOT NULL AND 
                EXISTS(SELECT 1 FROM posts p WHERE p.id = posts.id AND p.image IS NOT NULL) as image_exists
            FROM posts 
            JOIN users ON posts.user_id = users.id
            ORDER BY posts.created_at DESC
        ''', (session.get('user_id', -1),))
        
        posts = [dict(post) for post in cursor.fetchall()]
        
        return render_template('feed.html', posts=posts)
        
    except Exception as e:
        flash('Error loading posts', 'error')
        return render_template('feed.html', posts=[])
    finally:
        if conn:
            conn.close()

# Home page
@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    app.run(debug=True)
    CORS(app)


@app.route('/test_email')
def test_email():
    try:
        if send_otp_email('recipient@example.com', '123456'):
            return "Email sent successfully!"
        else:
            return "Failed to send email"
    except Exception as e:
        return f"Error: {str(e)}"