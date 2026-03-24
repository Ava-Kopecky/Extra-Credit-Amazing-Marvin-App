package org.example

import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.application.*
import io.ktor.server.routing.*
import io.ktor.server.response.*
import io.ktor.server.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import java.time.LocalDate

object Projects : Table("projects") {
    val id = integer("id").autoIncrement()
    val name = varchar("name", 255)
    val color = varchar("color", 20).default("#5b3cc4")
    override val primaryKey = PrimaryKey(id)
}

object Tasks : Table("tasks") {
    val id = integer("id").autoIncrement()
    val text = varchar("text", 255)
    val completed = bool("completed").default(false)
    val duration = varchar("duration", 50).nullable()
    val date = varchar("date", 20).default(LocalDate.now().toString())
    val projectId = integer("projectId").references(Projects.id).nullable()
    val label = varchar("label", 100).nullable()
    val priority = varchar("priority", 20).default("none")
    val dueDate = varchar("dueDate", 20).nullable()
    val notes = varchar("notes", 1000).nullable()
    val sortOrder = integer("sortOrder").default(0)
    val parentId = integer("parentId").nullable()
    override val primaryKey = PrimaryKey(id)
}

@Serializable
data class Project(val id: Int, val name: String, val color: String)

@Serializable
data class CreateProjectRequest(val name: String, val color: String = "#5b3cc4")

@Serializable
data class UpdateProjectRequest(val name: String? = null, val color: String? = null)

@Serializable
data class Task(
    val id: Int,
    val text: String,
    val completed: Boolean,
    val duration: String? = null,
    val date: String,
    val projectId: Int? = null,
    val label: String? = null,
    val priority: String = "none",
    val dueDate: String? = null,
    val notes: String? = null,
    val sortOrder: Int = 0,
    val parentId: Int? = null
)

@Serializable
data class CreateTaskRequest(
    val text: String,
    val date: String? = null,
    val projectId: Int? = null,
    val label: String? = null,
    val priority: String? = null,
    val dueDate: String? = null,
    val notes: String? = null,
    val parentId: Int? = null
)

@Serializable
data class UpdateTaskRequest(
    val text: String? = null,
    val completed: Boolean? = null,
    val duration: String? = null,
    val date: String? = null,
    val projectId: Int? = null,
    val label: String? = null,
    val priority: String? = null,
    val dueDate: String? = null,
    val notes: String? = null,
    val sortOrder: Int? = null,
    val parentId: Int? = null
)

fun rowToProject(row: ResultRow) = Project(
    id = row[Projects.id],
    name = row[Projects.name],
    color = row[Projects.color]
)

fun rowToTask(row: ResultRow) = Task(
    id = row[Tasks.id],
    text = row[Tasks.text],
    completed = row[Tasks.completed],
    duration = row[Tasks.duration],
    date = row[Tasks.date],
    projectId = row[Tasks.projectId],
    label = row[Tasks.label],
    priority = row[Tasks.priority],
    dueDate = row[Tasks.dueDate],
    notes = row[Tasks.notes],
    sortOrder = row[Tasks.sortOrder],
    parentId = row[Tasks.parentId]
)

fun initDatabase() {
    Database.connect("jdbc:sqlite:tasks.db", driver = "org.sqlite.JDBC")
    transaction {
        SchemaUtils.create(Projects, Tasks)
        if (Tasks.selectAll().count() == 0L) {
            val today = LocalDate.now().toString()
            val projectId = Projects.insert {
                it[name] = "Extra Credit App"
                it[color] = "#5b3cc4"
            } get Projects.id
            Tasks.insert { it[text] = "Finish extra credit setup"; it[date] = today; it[Tasks.projectId] = projectId }
            Tasks.insert { it[text] = "Design homepage layout"; it[date] = today; it[Tasks.projectId] = projectId }
            Tasks.insert { it[text] = "Connect frontend to Kotlin later"; it[date] = today; it[Tasks.projectId] = projectId }
        }
    }
}

fun main() {
    initDatabase()

    embeddedServer(Netty, port = 8080) {
        install(CORS) {
            anyHost()
            allowHeader(HttpHeaders.ContentType)
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Put)
            allowMethod(HttpMethod.Delete)
        }
        install(ContentNegotiation) { json() }

        routing {
            // --- Project Routes ---
            get("/projects") {
                val projects = transaction { Projects.selectAll().map { rowToProject(it) } }
                call.respond(projects)
            }

            post("/projects") {
                val body = call.receive<CreateProjectRequest>()
                val project = transaction {
                    val id = Projects.insert {
                        it[name] = body.name
                        it[color] = body.color
                    } get Projects.id
                    Project(id = id, name = body.name, color = body.color)
                }
                call.respond(HttpStatusCode.Created, project)
            }

            put("/projects/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@put call.respond(HttpStatusCode.BadRequest)
                val body = call.receive<UpdateProjectRequest>()
                val updated = transaction {
                    Projects.update({ Projects.id eq id }) { row ->
                        if (body.name != null) row[Projects.name] = body.name
                        if (body.color != null) row[Projects.color] = body.color
                    }
                    Projects.select { Projects.id eq id }.map { rowToProject(it) }.firstOrNull()
                }
                if (updated == null) call.respond(HttpStatusCode.NotFound)
                else call.respond(updated)
            }

            delete("/projects/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@delete call.respond(HttpStatusCode.BadRequest)
                val deleted = transaction { Projects.deleteWhere { Projects.id eq id } }
                if (deleted > 0) call.respond(HttpStatusCode.NoContent)
                else call.respond(HttpStatusCode.NotFound)
            }

            // --- Task Routes ---
            get("/tasks") {
                val date = call.request.queryParameters["date"]
                val projectId = call.request.queryParameters["projectId"]?.toIntOrNull()
                val label = call.request.queryParameters["label"]
                val tasks = transaction {
                    val allTasks = Tasks.selectAll().map { rowToTask(it) }
                    val filtered = when {
                        label != null -> allTasks.filter { it.label == label }
                        date != null && projectId != null -> allTasks.filter { it.date == date && it.projectId == projectId }
                        date != null -> allTasks.filter { it.date == date }
                        projectId != null -> allTasks.filter { it.projectId == projectId }
                        else -> allTasks
                    }
                    filtered.sortedBy { it.sortOrder }
                }
                call.respond(tasks)
            }

            post("/tasks") {
                val body = call.receive<CreateTaskRequest>()
                val taskDate = body.date ?: LocalDate.now().toString()
                val newTask = transaction {
                    val id = Tasks.insert {
                        it[text] = body.text
                        it[date] = taskDate
                        if (body.projectId != null) it[projectId] = body.projectId
                        if (body.label != null) it[label] = body.label
                        it[priority] = body.priority ?: "none"
                        if (body.dueDate != null) it[dueDate] = body.dueDate
                        if (body.notes != null) it[notes] = body.notes
                        if (body.parentId != null) it[parentId] = body.parentId
                    } get Tasks.id
                    Task(
                        id = id, text = body.text, completed = false, date = taskDate,
                        projectId = body.projectId, label = body.label,
                        priority = body.priority ?: "none", dueDate = body.dueDate,
                        notes = body.notes, parentId = body.parentId
                    )
                }
                call.respond(HttpStatusCode.Created, newTask)
            }

            put("/tasks/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@put call.respond(HttpStatusCode.BadRequest)
                val body = call.receive<UpdateTaskRequest>()
                val updated = transaction {
                    Tasks.update({ Tasks.id eq id }) { row ->
                        if (body.text != null) row[Tasks.text] = body.text
                        if (body.completed != null) row[Tasks.completed] = body.completed
                        if (body.duration != null) row[Tasks.duration] = body.duration
                        if (body.date != null) row[Tasks.date] = body.date
                        // Always update projectId when provided in request
                        row[Tasks.projectId] = if (body.projectId != null) body.projectId else null
                        if (body.label != null) row[Tasks.label] = body.label.ifEmpty { null }
                        if (body.priority != null) row[Tasks.priority] = body.priority
                        if (body.dueDate != null) row[Tasks.dueDate] = body.dueDate.ifEmpty { null }
                        if (body.notes != null) row[Tasks.notes] = body.notes.ifEmpty { null }
                        if (body.sortOrder != null) row[Tasks.sortOrder] = body.sortOrder
                        if (body.parentId != null) row[Tasks.parentId] = body.parentId
                    }
                    Tasks.select { Tasks.id eq id }.map { rowToTask(it) }.firstOrNull()
                }
                if (updated == null) call.respond(HttpStatusCode.NotFound)
                else call.respond(updated)
            }

            delete("/tasks/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@delete call.respond(HttpStatusCode.BadRequest)
                val deleted = transaction { Tasks.deleteWhere { Tasks.id eq id } }
                if (deleted > 0) call.respond(HttpStatusCode.NoContent)
                else call.respond(HttpStatusCode.NotFound)
            }
        }
    }.start(wait = true)
}