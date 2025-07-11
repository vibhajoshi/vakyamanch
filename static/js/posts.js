
const currentUserId = document.body.dataset.userId || null; // Make sure to set this in your template

async function loadPosts() {
    const container = document.getElementById('posts-container');
    
    // Add null check
    if (!container) {
        console.error('Posts container not found in DOM');
        return;
    }
    
    container.innerHTML = '<p>Loading posts...</p>';
    
    try {
        const response = await fetch('/posts');
        
        if (!response.ok) {
            let errorMsg = `HTTP Error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += ` - ${errorData.error || 'Unknown error'}`;
            } catch {
                errorMsg += ' - Could not parse error details';
            }
            throw new Error(errorMsg);
        }
        
        const posts = await response.json();
        
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p>No posts found.</p>';
            return;
        }
        
        renderPosts(posts);
    } catch (error) {
        console.error('Post loading failed:', error);
        container.innerHTML = `
            <div class="error">
                <p>Failed to load posts</p>
                <p><small>${escapeHtml(error.message)}</small></p>
                <button onclick="loadPosts()">Retry</button>
            </div>
        `;
    }
}

// Update renderPosts function to include action buttons
function renderPosts(posts, isDashboard = false) {
    const container = document.getElementById(isDashboard ? 'user-posts-container' : 'posts-container');
    
    container.innerHTML = posts.map(post => `
        <div class="post" data-post-id="${post.id}" data-user-id="${post.user_id}">
            <h4>${escapeHtml(post.title)}</h4>
            ${post.image ? `
                <img src="/static/uploads/${escapeHtml(post.image)}" 
                     alt="Post image" 
                     class="post-image"
                     onerror="this.style.display='none'">
            ` : ''}
            <p>${escapeHtml(post.content)}</p>
            <small>
                Posted by ${escapeHtml(post.username)}
            </small>
            
            <div class="like-section">
                <button class="like-button" data-post-id="${post.id}">
                    <span class="like-icon">${post.user_liked ? '❤️' : '♡'}</span>
                    <span class="like-count">${post.like_count || 0}</span>
                </button>
            </div>
            
            <button class="comment-toggle" data-post-id="${post.id}">
                Comments (<span class="comment-count">${post.comment_count || 0}</span>)
            </button>
            
            ${isDashboard ? `
                <div class="post-actions">
                    <button class="button small edit-post" data-post-id="${post.id}">Edit</button>
                    <button class="button small danger delete-post" data-post-id="${post.id}">Delete</button>
                </div>
            ` : ''}
            
            <div class="comment-section" id="comments-${post.id}" style="display:none;">
                <div class="comment-form">
                    <textarea class="comment-textarea" 
                              placeholder="Write a comment..." 
                              data-post-id="${post.id}"></textarea>
                    <button class="comment-submit-btn" 
                            data-post-id="${post.id}">
                        <i class="fas fa-paper-plane"></i> Post
                    </button>
                </div>
                <div class="comments-list"></div>
            </div>
        </div>
    `).join('');
    
    if (isDashboard) {
        setupPostActions();
    }
}

function canCommentOnPost(postAuthorId) {
    return currentUserId && currentUserId != postAuthorId;
}


function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true // Use false if you want 24-hour format
    });
}


// Basic HTML escaping for security
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setupPostForm() {
    const form = document.getElementById('create-post-form');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const title = document.getElementById('post-title').value;
        const content = document.getElementById('post-content').value;
        const imageInput = document.getElementById('post-image');
        const imageFile = imageInput.files[0];
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        try {
            const response = await fetch('/create_post', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                form.reset();
                
                // Add new post to the list
                const postsContainer = document.getElementById('user-posts-container');
                const postElement = document.createElement('div');
                postElement.className = 'post';
                
                let imageHtml = '';
                if (data.image) {
                    imageHtml = `<img src="/static/uploads/${data.image}" alt="Post image" class="post-image">`;
                }
                
                postElement.innerHTML = `
                    <h4>${data.title}</h4>
                    ${imageHtml}
                    <p>${data.content}</p>
                    <small>Posted on ${new Date(data.created_at).toLocaleString()}</small>
                `;
                
                if (postsContainer.firstChild) {
                    postsContainer.insertBefore(postElement, postsContainer.firstChild);
                } else {
                    postsContainer.appendChild(postElement);
                }
            } else {
                alert(data.error || 'Failed to create post');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while creating the post');
        }
    });
}

// Add to posts.js
function setupPostActions() {
    // Edit buttons
    document.querySelectorAll('.edit-post').forEach(button => {
        button.addEventListener('click', function() {
            const postId = this.dataset.postId;
            window.location.href = `/edit_post/${postId}`;
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-post').forEach(button => {
        button.addEventListener('click', async function() {
            const postId = this.dataset.postId;
            
            if (confirm('Are you sure you want to delete this post?')) {
                try {
                    const response = await fetch(`/delete_post/${postId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'same-origin'
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        // Remove post from DOM
                        document.querySelector(`.post[data-post-id="${postId}"]`).remove();
                        alert('Post deleted successfully');
                    } else {
                        alert(data.error || 'Failed to delete post');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('An error occurred while deleting the post');
                }
            }
        });
    });
}

// Like functionality
document.addEventListener('DOMContentLoaded', function() {
    // Handle like button clicks
    // Update the like button click handler in posts.js
    document.querySelectorAll('.like-button').forEach(button => {
        button.addEventListener('click', async function() {
            console.log('Like button clicked'); // Debug
            const postId = this.dataset.postId;
            const likeCountElement = this.querySelector('.like-count');
            const likeIcon = this.querySelector('.like-icon');
            
            try {
                console.log(`Attempting to like post ${postId}`); // Debug
                const response = await fetch(`/like_post/${postId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin'
                });
                
                console.log('Received response:', response); // Debug
                const data = await response.json();
                console.log('Response data:', data); // Debug
                
                if (response.ok) {
                    // Update like count
                    console.log('Like successful, updating UI'); // Debug
                    likeCountElement.textContent = data.like_count;
                    
                    // Toggle liked state
                    if (data.action === 'liked') {
                        this.classList.add('liked');
                        likeIcon.textContent = '❤️'; // Solid heart
                    } else {
                        this.classList.remove('liked');
                        likeIcon.textContent = '♡'; // Outline heart
                    }
                } else {
                    console.error('Like failed:', data.error); // Debug
                    alert(data.error || 'Failed to like post');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred while liking the post');
            }
        });
    });
 
// Initialize everything properly
document.addEventListener('DOMContentLoaded', function() {
    // First make sure the container exists
    if (!document.getElementById('posts-container')) {
        console.error('Main container not found in DOM');
        return;
    }
    
    // Set up all event listeners
    setupCommentToggle();
    setupPostInteractions();
    
    // Then load posts
    loadPosts();
});   

    // Update the comment toggle function in posts.js
    // Unified comment toggle handler
// Replace the comment toggle handler with this faster version
document.addEventListener('click', async function(e) {
    if (e.target.classList.contains('comment-submit-btn')) {
        e.preventDefault();
        const postId = e.target.dataset.postId;
        await submitComment(postId);
    }

    if (e.target.closest('.delete-comment')) {
        const deleteBtn = e.target.closest('.delete-comment');
        const commentId = deleteBtn.dataset.commentId;
        await deleteComment(commentId);
    }
});


    // Update comment submission
    document.querySelectorAll('.submit-comment').forEach(button => {
        button.addEventListener('click', async function() {
            console.log('Submit comment clicked'); // Debug
            const postId = this.dataset.postId;
            const commentInput = this.previousElementSibling; // The textarea
            const content = commentInput.value.trim();
            
            if (!content) {
                alert('Please write a comment');
                return;
            }
            
            try {
                console.log('Submitting comment:', content); // Debug
                const formData = new FormData();
                formData.append('content', content);
                
                const response = await fetch(`/comment_post/${postId}`, {
                    method: 'POST',
                    body: formData
                });
                
                console.log('Comment submission response:', response); // Debug
                const data = await response.json();
                console.log('Comment response data:', data); // Debug
                
                if (response.ok) {
                    // Add new comment to list
                    console.log('Comment successful, updating UI'); // Debug
                    const commentsList = this.parentElement.nextElementSibling;
                    commentsList.prepend(createCommentElement(data.comment));
                    
                    // Update comment count
                    const commentCount = document.querySelector(`.comment-toggle[data-post-id="${postId}"] .comment-count`);
                    commentCount.textContent = parseInt(commentCount.textContent) + 1;
                    
                    // Clear input
                    commentInput.value = '';
                } else {
                    console.error('Comment failed:', data.error); // Debug
                    alert(data.error || 'Failed to post comment');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred while posting the comment');
            }
        });
    });
});

// Add to posts.js - Read More functionality
function setupPostLinks() {
    // This will handle any post title clicks to view the full post
    document.querySelectorAll('.post-title').forEach(title => {
        title.style.cursor = 'pointer';
        title.addEventListener('click', function() {
            const postId = this.closest('.post-card').dataset.postId;
            window.location.href = `/post/${postId}`;
        });
    });
}

// Update the setupPostInteractions function to include the new setup
// Update the setupPostInteractions function
function setupPostInteractions() {
    document.addEventListener('click', async function(e) {
        // Handle likes
        if (e.target.closest('.like-button')) {
            const button = e.target.closest('.like-button');
            const postId = button.dataset.postId;
            await handleLike(postId);
        }
        
        // Handle comment toggle - this is the key fix
        if (e.target.closest('.comment-toggle')) {
            const toggleButton = e.target.closest('.comment-toggle');
            const postId = toggleButton.dataset.postId;
            const commentSection = document.getElementById(`comments-${postId}`);
            
            if (commentSection) {
                // Toggle visibility
                const isHidden = commentSection.style.display === 'none';
                commentSection.style.display = isHidden ? 'block' : 'none';
                
                // Load comments if showing
                if (isHidden) {
                    await loadComments(postId);
                }
            }
        }
        
        // Handle comment submissions
        if (e.target.closest('.comment-submit-btn')) {
            e.preventDefault();
            const button = e.target.closest('.comment-submit-btn');
            const postId = button.dataset.postId;
            await submitComment(postId);
        }
    });
}
// Like button functionality
function setupLikeButtons() {
    document.querySelectorAll('.like-button').forEach(btn => {
        // Remove any existing listeners first
        btn.replaceWith(btn.cloneNode(true));
        
        // Add fresh listener
        const newBtn = document.querySelector(`.like-button[data-post-id="${btn.dataset.postId}"]`);
        newBtn.addEventListener('click', () => handleLike(btn.dataset.postId));
    });
}

// Updated like button handler
// Update this in your like button handler
async function handleLike(postId) {
    const likeBtn = document.querySelector(`.like-button[data-post-id="${postId}"]`);
    if (!likeBtn) return;
    
    likeBtn.disabled = true;
    const likeIcon = likeBtn.querySelector('.like-icon');
    const likeCount = likeBtn.querySelector('.like-count');
    
    try {
        const response = await fetch(`/like_post/${postId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') || ''
            },
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (data.code === 'SELF_LIKE_NOT_ALLOWED') {
                showFlashMessage("You can't like your own post", 'error');
            } else {
                throw new Error(data.error || 'Like action failed');
            }
            return;
        }
        
        // Update UI
        likeCount.textContent = data.like_count;
        likeIcon.textContent = data.action === 'liked' ? '❤️' : '♡';
        likeIcon.style.color = data.action === 'liked' ? 'red' : '';
        
    } catch (error) {
        console.error('Like error:', error);
        showFlashMessage(error.message, 'error');
    } finally {
        likeBtn.disabled = false;
    }
}

async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
        const response = await fetch(`/delete_comment/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
            if (commentElement) {
                const postElement = commentElement.closest('.post');
                const postId = postElement.dataset.postId;
                
                // Remove comment from DOM
                commentElement.remove();
                
                // Update comment count
                updateCommentCount(postId, -1);
                
                // Show success message
                showFlashMessage('Comment deleted successfully', 'success');
            }
        } else {
            throw new Error(data.error || 'Failed to delete comment');
        }
    } catch (error) {
        console.error('Error:', error);
        showFlashMessage(error.message, 'error');
    }
}

// Helper function to show flash messages
function showFlashMessage(message, type = 'info') {
    const flash = document.createElement('div');
    flash.className = `flash-message ${type}`;
    flash.textContent = message;
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.remove();
    }, 3000);
}

// Previous code remains the same

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
});

// Add CSRF token helper function
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Improved comment toggle handler
function setupCommentToggle() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('comment-toggle')) {
            const postId = e.target.dataset.postId;
            const commentSection = document.getElementById(`comments-${postId}`);
            
            if (commentSection) {
                // Toggle visibility
                commentSection.style.display = 
                    commentSection.style.display === 'none' ? 'block' : 'none';
                
                // Load comments if showing
                if (commentSection.style.display === 'block') {
                    loadComments(postId);
                }
            }
        }
    });
}

let isSubmittingComment = false; // Global flag to prevent duplicate submissions

// Updated comment submission setup
function setupComments() {
    setupCommentToggle();
    
    // Comment submission handler
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('comment-submit-btn')) {
            e.preventDefault();
            const postId = e.target.dataset.postId;
            submitComment(postId);
        }
    });
    
    // Delete comment handler
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-comment')) {
            const commentId = e.target.dataset.commentId;
            deleteComment(commentId);
        }
    });
}


// Updated comment submission handler - THE FINAL FIX
// Unified comment submission handler
document.addEventListener('click', async function(e) {
    if (e.target.classList.contains('comment-submit-btn')) {
        e.preventDefault();
        const postId = e.target.dataset.postId;
        await submitComment(postId);
    }
});

// Updated submitComment function
// Updated submitComment function with better error handling
async function submitComment(postId) {
    // Check if already submitting
    if (isSubmittingComment) {
        console.log('Preventing duplicate comment submission');
        return;
    }
    
    const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
    if (!postElement) return;

    const commentInput = postElement.querySelector('.comment-textarea');
    const submitBtn = postElement.querySelector('.comment-submit-btn');
    const commentsList = postElement.querySelector('.comments-list');
    
    const content = commentInput.value.trim();
    if (!content) {
        showFlashMessage('Please write a comment', 'error');
        return;
    }
    
    try {
        // Set submitting state
        isSubmittingComment = true;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
        
        const response = await fetch(`/comment_post/${postId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') || ''
            },
            body: JSON.stringify({ content }),
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to post comment');
        }
        
        const data = await response.json();
        
        // Clear input
        commentInput.value = '';
        
        // Add new comment to list
        if (commentsList) {
            commentsList.prepend(createCommentElement(data.comment || data));
        }
        
        // Update comment count
        if (data.comment_count !== undefined) {
            updateCommentCount(postId, data.comment_count);
        } else {
            // Fallback: increment count if we don't get the total count
            const currentCount = parseInt(document.querySelector(`.comment-toggle[data-post-id="${postId}"] .comment-count`).textContent) || 0;
            updateCommentCount(postId, currentCount + 1);
        }
        
        showFlashMessage('Comment posted successfully', 'success');
    } catch (error) {
        console.error('Error posting comment:', error);
        showFlashMessage(error.message, 'error');
    } finally {
        // Reset submitting state
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post';
        isSubmittingComment = false;
    }
}
async function loadComments(postId) {
    try {
        const postElement = document.querySelector(`.post[data-post-id="${postId}"]`) || 
                           document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (!postElement) return;
        
        const commentsList = postElement.querySelector('.comments-list');
        if (!commentsList) return;
        
        // Show loading state
        commentsList.innerHTML = '<p class="loading">Loading comments...</p>';
        
        const response = await fetch(`/get_comments/${postId}`);
        if (!response.ok) throw new Error('Failed to load comments');
        
        const comments = await response.json();
        
        // Clear existing comments
        commentsList.innerHTML = '';
        
        if (comments.length === 0) {
            commentsList.innerHTML = '<p class="no-comments">No comments yet</p>';
            return;
        }
        
        // Add comments
        comments.forEach(comment => {
            commentsList.appendChild(createCommentElement(comment));
        });
        
    } catch (error) {
        console.error('Error loading comments:', error);
        const commentsList = document.querySelector(`#comments-${postId} .comments-list`);
        if (commentsList) {
            commentsList.innerHTML = `<p class="error">Error loading comments: ${error.message}</p>`;
        }
    }
}

// Helper function to update comment count
function updateCommentCount(postId, count) {
    const commentToggle = document.querySelector(`.comment-toggle[data-post-id="${postId}"]`);
    if (!commentToggle) return;
    
    const commentCountEl = commentToggle.querySelector('.comment-count');
    if (!commentCountEl) return;
    
    commentCountEl.textContent = count;
}

// Add this new function
function setupDeleteCommentButtons() {
    document.querySelectorAll('.delete-comment').forEach(button => {
        button.addEventListener('click', async function() {
            const commentId = this.dataset.commentId;
            const commentElement = this.closest('.comment');
            
            if (confirm('Are you sure you want to delete this comment?')) {
                try {
                    const response = await fetch(`/delete_comment/${commentId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'same-origin'
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        // Remove comment from DOM
                        commentElement.remove();
                        
                        // Update comment count if on feed page
                        const postId = commentElement.closest('.post-card, .post-detail')?.dataset?.postId;
                        if (postId) {
                            updateCommentCount(postId, -1);
                        }
                        
                        // Show success message
                        alert('Comment deleted successfully');
                    } else {
                        alert(data.error || 'Failed to delete comment');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('An error occurred while deleting the comment');
                }
            }
        });
    });
}

// Initialize comment functionality
function setupComments() {
    // Remove all existing listeners first
    document.querySelectorAll('.submit-comment').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    
    setupDeleteCommentButtons();
    // Add fresh listeners
    document.querySelectorAll('.submit-comment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            submitComment(btn.dataset.postId);
        });
    });
    
    // Initialize comment toggles
    document.querySelectorAll('.comment-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = btn.dataset.postId;
            const commentsSection = document.getElementById(`comments-${postId}`);
            commentsSection.classList.toggle('hidden');
            
            if (!commentsSection.classList.contains('hidden')) {
                loadComments(postId);
            }
        });
    });
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', () => {
    setupComments();
    loadPosts();
    setupPostInteractions();
});

// Update the createCommentElement function to include delete button
function createCommentElement(comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment';
    commentEl.dataset.commentId = comment.id;
    
    // Check if current user can delete this comment
    const currentUserId = document.body.dataset.userId || null;
    const canDelete = currentUserId && 
                     (comment.user_id == currentUserId || comment.post_author_id == currentUserId);
    
    commentEl.innerHTML = `
        <div class="comment-header">
            <span class="comment-author">${escapeHtml(comment.username)}</span>
            <span class="comment-date">${formatDate(comment.created_at)}</span>
            ${canDelete ? `
                <button class="delete-comment" data-comment-id="${comment.id}">
                    Delete
                </button>
            ` : ''}
        </div>
        <div class="comment-content">${escapeHtml(comment.content)}</div>
    `;
    
    return commentEl;
}


// Format date for display


// Basic HTML escaping for security
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', function() {
    setupComments();
    loadPosts();
    setupPostInteractions();
});



window.loadPosts = loadPosts;